import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import express, {type NextFunction, type Request, type Response} from 'express';
import {GoogleGenAI, ThinkingLevel} from '@google/genai';
import {z} from 'zod';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const BD_PHONE_REGEX = /^(?:\+?880|0)1[3-9]\d{8}$/;

// In-memory sliding-window rate limiter & recent idempotency guard
interface VerifiedOrderEntry {
  ts: number;
  orderNumber?: string;
  totalAmount?: number;
  verifiedAt: string;
}

const rateBuckets = new Map<string, {count: number; resetAt: number}>();
const seenIdempotencyKeys = new Map<string, VerifiedOrderEntry>();

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
  orderId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{8,128}$/, 'Invalid order ID')
    .optional(),
  orderNumber: z.string().trim().min(6).max(40).optional(),
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{8,128}$/, 'Invalid order idempotency key'),
  totalAmount: z.number().positive().optional(),
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

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().trim().min(1).max(1200),
      })
    )
    .min(1)
    .max(20),
  storeContext: z
    .object({
      brandName: z.string().max(120).optional(),
      supportEmail: z.string().max(200).optional(),
      supportPhone: z.string().max(40).optional(),
      whatsappNumber: z.string().max(40).optional(),
      address: z.string().max(240).optional(),
      language: z.enum(['en', 'bn']).optional(),
      shipping: z
        .object({
          dhakaFee: z.number().optional(),
          outsideDhakaFee: z.number().optional(),
          freeDhakaThreshold: z.number().optional(),
          estimatedDhakaDays: z.string().max(60).optional(),
          estimatedOutsideDays: z.string().max(60).optional(),
        })
        .optional(),
      products: z
        .array(
          z.object({
            name: z.string().max(160),
            slug: z.string().max(160).optional(),
            categoryName: z.string().max(80).optional(),
            regularPrice: z.number(),
            discountedPrice: z.number().optional(),
            stockQuantity: z.number(),
            ratingAvg: z.number().optional(),
            ratingCount: z.number().optional(),
            shortDescription: z.string().max(300).optional(),
          })
        )
        .max(60)
        .optional(),
      isAuthenticated: z.boolean().optional(),
      orders: z
        .array(
          z.object({
            orderNumber: z.string().max(60),
            orderStatus: z.string().max(40),
            paymentStatus: z.string().max(40).optional(),
            totalAmount: z.number(),
            trackingCode: z.string().max(80).optional(),
            itemsSummary: z.string().max(300).optional(),
            updatedAt: z.string().max(80).optional(),
          })
        )
        .max(20)
        .optional(),
    })
    .optional(),
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
      res.status(401).json({
        ok: false,
        verified: false,
        error: 'Authenticated customer session token is required to verify this order.',
      });
      return;
    }

    const parsed = checkoutVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        verified: false,
        error: parsed.error.issues[0]?.message || 'Invalid order verification payload.',
      });
      return;
    }

    const {orderId, orderNumber, idempotencyKey, totalAmount, paymentMethod} = parsed.data;
    if (orderId && orderId !== idempotencyKey) {
      res.status(422).json({
        ok: false,
        verified: false,
        error: 'Order document ID does not match the checkout idempotency key.',
      });
      return;
    }

    const resolvedOrderId = orderId || idempotencyKey;
    const now = Date.now();
    const existing = seenIdempotencyKeys.get(resolvedOrderId);
    if (existing && now - existing.ts < 30 * 60_000) {
      if (
        (existing.orderNumber && orderNumber && existing.orderNumber !== orderNumber) ||
        (existing.totalAmount !== undefined && totalAmount !== undefined && existing.totalAmount !== totalAmount)
      ) {
        res.status(422).json({
          ok: false,
          verified: false,
          error: 'Order verification details do not match the previously verified order.',
        });
        return;
      }

      res.json({
        ok: true,
        verified: true,
        alreadyVerified: true,
        orderId: resolvedOrderId,
        orderNumber: orderNumber || existing.orderNumber,
        idempotencyKey,
        paymentMethod,
        verifiedAt: existing.verifiedAt,
      });
      return;
    }

    const verifiedAt = new Date().toISOString();
    seenIdempotencyKeys.set(resolvedOrderId, {ts: now, orderNumber, totalAmount, verifiedAt});

    // Prune stale idempotency entries
    if (seenIdempotencyKeys.size > 500) {
      for (const [k, entry] of seenIdempotencyKeys.entries()) {
        if (now - entry.ts > 30 * 60_000) seenIdempotencyKeys.delete(k);
      }
    }

    res.json({
      ok: true,
      verified: true,
      alreadyVerified: false,
      orderId: resolvedOrderId,
      orderNumber,
      idempotencyKey,
      paymentMethod,
      verifiedAt,
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

  app.post('/api/chat', rateLimitApi, async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'Assistant is currently unavailable because GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({error: parsed.error.issues[0]?.message || 'Invalid chat request'});
      return;
    }

    const {messages, storeContext} = parsed.data;
    const brandName = storeContext?.brandName || 'SHIKDER SHOP';
    const shipping = storeContext?.shipping;
    const productsList = (storeContext?.products || [])
      .map((p) => {
        const effectivePrice = p.discountedPrice && p.discountedPrice > 0 ? p.discountedPrice : p.regularPrice;
        const stockText = p.stockQuantity > 0 ? `In stock (${p.stockQuantity})` : 'Out of stock';
        const ratingText =
          p.ratingCount && p.ratingCount > 0 ? `, Rating: ${p.ratingAvg?.toFixed(1) || '0.0'}/5 (${p.ratingCount} reviews)` : '';
        return `- ${p.name} [${p.categoryName || 'General'}]: ৳${effectivePrice}${
          p.discountedPrice && p.discountedPrice > 0 ? ` (was ৳${p.regularPrice})` : ''
        } | ${stockText}${ratingText}${p.shortDescription ? ` | ${p.shortDescription}` : ''}`;
      })
      .join('\n');

    const ordersList = storeContext?.isAuthenticated
      ? (storeContext.orders || []).length > 0
        ? (storeContext.orders || [])
            .map(
              (o) =>
                `- ${o.orderNumber}: Status=${o.orderStatus}, Payment=${o.paymentStatus || 'Cash on Delivery'}, Total=৳${o.totalAmount}${
                  o.trackingCode ? `, Courier Tracking=${o.trackingCode}` : ''
                }${o.itemsSummary ? `, Items=[${o.itemsSummary}]` : ''}`
            )
            .join('\n')
        : 'This signed-in customer currently has no orders.'
      : 'Customer is NOT signed in.';

    const systemInstruction = [
      `You are the official customer support assistant for ${brandName}, a single-vendor Bangladesh e-commerce storefront.`,
      'Answer concisely, warmly, and accurately in under 150 words unless listing products or orders.',
      'Reply in the same language the customer uses (English or Bengali).',
      'Only cite products, prices in BDT (৳), stock availability, ratings, shipping rules, and order details provided in the LIVE STORE CONTEXT below. Never invent products, prices, tracking codes, or order statuses.',
      'If the customer asks about their order status and is NOT signed in, politely advise them to sign in with Google or Email/Password to view their personal order status.',
      'For human support, share the store WhatsApp number, email, or physical address from context.',
      '',
      '=== LIVE STORE CONTEXT ===',
      `Store: ${brandName}`,
      `Address: ${storeContext?.address || 'Asuliya, Savar, Dhaka, Bangladesh'}`,
      `WhatsApp: ${storeContext?.whatsappNumber || '01996266204'} | Support Phone: ${storeContext?.supportPhone || '+880 1996-266204'} | Email: ${storeContext?.supportEmail || 'bnagladeshbodnaparty@gmail.com'}`,
      `Payment Method: Cash on Delivery (COD) nationwide across all 64 districts of Bangladesh.`,
      shipping
        ? `Shipping Charges: Inside Dhaka ৳${shipping.dhakaFee ?? 70} (${shipping.estimatedDhakaDays || '1-2 business days'}), Outside Dhaka ৳${shipping.outsideDhakaFee ?? 130} (${shipping.estimatedOutsideDays || '2-4 business days'}), Free Dhaka delivery above ৳${shipping.freeDhakaThreshold ?? 3500}.`
        : '',
      '',
      'Catalog Products:',
      productsList || 'No products loaded.',
      '',
      'Customer Orders:',
      ordersList,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{text: m.text}],
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({error: 'Received an empty response from Gemini. Please try asking again.'});
        return;
      }

      res.json({reply});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach Gemini assistant right now.';
      const status =
        msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')
          ? 429
          : msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')
            ? 403
            : 500;
      res.status(status).json({error: msg});
    }
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
