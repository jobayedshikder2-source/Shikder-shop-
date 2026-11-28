import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import express, {type NextFunction, type Request, type Response} from 'express';
import {z} from 'zod';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const BD_PHONE_REGEX = /^(?:\+?880|0)1[3-9]\d{8}$/;

// In-memory sliding-window rate limiter & recent idempotency guard
const rateBuckets = new Map<string, {count: number; resetAt: number}>();
const seenIdempotencyKeys = new Map<string, number>();

function rateLimitApi(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, {count: 1, resetAt: now + 60_000});
    next();
    return;
  }
  if (bucket.count >= 60) {
    res.status(429).json({error: 'Too many requests. Please wait a moment before retrying.'});
    return;
  }
  bucket.count += 1;
  next();
}

const checkoutVerifySchema = z.object({
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{8,128}$/, 'Invalid order idempotency key'),
  customerInfo: z.object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().regex(BD_PHONE_REGEX, 'Invalid Bangladesh mobile number'),
    email: z.string().email().max(200),
    division: z.string().min(2).max(60),
    district: z.string().min(2).max(60),
    upazila: z.string().min(2).max(80),
    area: z.string().min(1).max(100),
    fullAddress: z.string().min(4).max(300),
    instructions: z.string().max(240).optional(),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
        quantity: z.number().int().min(1).max(50),
        variantId: z.string().max(128).optional(),
      })
    )
    .min(1)
    .max(50),
  couponCode: z.string().max(40).optional(),
  paymentMethod: z.enum(['cod']),
});

async function createApp() {
  const app = express();
  const httpServer = http.createServer(app);
  app.disable('x-powered-by');
  app.use(express.json({limit: '256kb'}));

  // Security headers across all routes (iframe-friendly in AI Studio dev preview)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (IS_PROD) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      brand: 'SHIKDER SHOP',
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      gateways: {
        cod: true,
      },
    });
  });

  app.post('/api/checkout/verify', rateLimitApi, (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 20) {
      res.status(401).json({error: 'Authenticated customer session token is required for checkout.'});
      return;
    }

    const parsed = checkoutVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({error: parsed.error.issues[0]?.message || 'Invalid checkout payload'});
      return;
    }

    const {idempotencyKey, paymentMethod} = parsed.data;

    // Prevent rapid duplicate submissions on the same idempotencyKey
    const now = Date.now();
    const prevTs = seenIdempotencyKeys.get(idempotencyKey);
    if (prevTs && now - prevTs < 10 * 60_000) {
      res.status(409).json({error: 'Duplicate order request detected for this checkout session.'});
      return;
    }
    seenIdempotencyKeys.set(idempotencyKey, now);

    // Prune stale idempotency entries
    if (seenIdempotencyKeys.size > 500) {
      for (const [k, ts] of seenIdempotencyKeys.entries()) {
        if (now - ts > 15 * 60_000) seenIdempotencyKeys.delete(k);
      }
    }

    res.json({
      ok: true,
      idempotencyKey,
      paymentMethod,
      verifiedAt: new Date().toISOString(),
    });
  });

  app.post('/api/coupons/validate', rateLimitApi, (req, res) => {
    const schema = z.object({
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,40}$/),
      subtotal: z.number().min(0),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({valid: false, error: 'Invalid coupon format'});
      return;
    }
    res.json({valid: true, normalizedCode: parsed.data.code});
  });

  app.get('/robots.txt', (req, res) => {
    const origin = process.env.APP_URL && !process.env.APP_URL.startsWith('MY_')
      ? process.env.APP_URL
      : `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /checkout',
        'Disallow: /profile',
        'Disallow: /orders',
        'Disallow: /api/',
        `Sitemap: ${origin}/sitemap.xml`,
      ].join('\n')
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = process.env.APP_URL && !process.env.APP_URL.startsWith('MY_')
      ? process.env.APP_URL
      : `${req.protocol}://${req.get('host')}`;
    const urls = [
      '/',
      '/products',
      '/categories',
      '/categories/audio-tech',
      '/categories/fashion',
      '/categories/watches',
      '/categories/home-kitchen',
      '/categories/travel-bags',
      '/about',
      '/contact',
      '/faq',
      '/privacy-policy',
      '/terms',
      '/return-policy',
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${origin}${u}</loc>
    <changefreq>${u === '/' || u === '/products' ? 'daily' : 'weekly'}</changefreq>
    <priority>${u === '/' ? '1.0' : '0.8'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  });

  if (!IS_PROD) {
    const disableHmr =
      process.env.DISABLE_HMR === 'true' ||
      Boolean(process.env.K_SERVICE) ||
      Boolean(process.env.APP_URL?.includes('.run.app'));

    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : {server: httpServer},
        ...(disableHmr ? {ws: false, watch: null} : {}),
      },
      appType: 'spa',
    });

    if (disableHmr) {
      app.get('/@vite/client', (_req, res) => {
        res.type('application/javascript').send(`import "/@vite/env";
const sheetsMap = new Map();
const linkSheetsMap = new Map();
const cspNonce = "document" in globalThis ? document.querySelector("meta[property=csp-nonce]")?.nonce : void 0;
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (cspNonce) style.setAttribute("nonce", cspNonce);
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = void 0; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll(\`link[rel="stylesheet"][data-vite-dev-id="\${CSS.escape(id)}"]\`).forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const data = {};
  return {
    get data() { return data; },
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}
export class ErrorOverlay extends (typeof HTMLElement !== "undefined" ? HTMLElement : class {}) {
  close() { this.parentNode?.removeChild(this); }
}
`);
      });
    }

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, {maxAge: '7d'}));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SHIKDER SHOP server listening on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start SHIKDER SHOP server:', err);
  process.exit(1);
});
