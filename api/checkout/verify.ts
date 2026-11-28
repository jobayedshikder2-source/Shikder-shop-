import type {IncomingMessage, ServerResponse} from 'node:http';
import {z} from 'zod';

const BD_PHONE_REGEX = /^(?:\+?880|0)1[3-9]\d{8}$/;

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

interface VerifiedRecord {
  orderNumber?: string;
  totalAmount?: number;
  verifiedAt: string;
}

const verifiedOrders = new Map<string, VerifiedRecord>();

type VercelLikeReq = IncomingMessage & {body?: unknown};
type VercelLikeRes = ServerResponse & {
  status?: (code: number) => VercelLikeRes;
  json?: (payload: unknown) => void;
};

function sendJson(res: VercelLikeRes, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: VercelLikeReq): Promise<unknown> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      return JSON.parse(req.body);
    }
    return req.body;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export default async function handler(req: VercelLikeReq, res: VercelLikeRes) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, {ok: false, verified: false, error: 'Method not allowed'});
    return;
  }

  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 20) {
    sendJson(res, 401, {
      ok: false,
      verified: false,
      error: 'Authenticated customer session token is required to verify this order.',
    });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, {ok: false, verified: false, error: 'Malformed JSON verification payload.'});
    return;
  }

  const parsed = checkoutVerifySchema.safeParse(body);
  if (!parsed.success) {
    sendJson(res, 400, {
      ok: false,
      verified: false,
      error: parsed.error.issues[0]?.message || 'Invalid order verification payload.',
    });
    return;
  }

  const {orderId, orderNumber, idempotencyKey, totalAmount, paymentMethod} = parsed.data;
  if (orderId && orderId !== idempotencyKey) {
    sendJson(res, 422, {
      ok: false,
      verified: false,
      error: 'Order document ID does not match the checkout idempotency key.',
    });
    return;
  }

  const resolvedOrderId = orderId || idempotencyKey;
  const existing = verifiedOrders.get(resolvedOrderId);
  if (existing) {
    if (
      (existing.orderNumber && orderNumber && existing.orderNumber !== orderNumber) ||
      (existing.totalAmount !== undefined && totalAmount !== undefined && existing.totalAmount !== totalAmount)
    ) {
      sendJson(res, 422, {
        ok: false,
        verified: false,
        error: 'Order verification details do not match the previously verified order.',
      });
      return;
    }

    sendJson(res, 200, {
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
  verifiedOrders.set(resolvedOrderId, {orderNumber, totalAmount, verifiedAt});

  if (verifiedOrders.size > 500) {
    const firstKey = verifiedOrders.keys().next().value;
    if (firstKey) verifiedOrders.delete(firstKey);
  }

  sendJson(res, 200, {
    ok: true,
    verified: true,
    alreadyVerified: false,
    orderId: resolvedOrderId,
    orderNumber,
    idempotencyKey,
    paymentMethod,
    verifiedAt,
  });
}
