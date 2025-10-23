import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

type Item = { id: string; title: string; tickets: number };

const ITEMS: Item[] = [
  { id: 'L1', title: '1 000 000', tickets: 1 },
  { id: 'R1', title: '500 000', tickets: 2 },
  { id: 'R2', title: '300 000', tickets: 4 },
  { id: 'C1', title: '10 000',    tickets: 3000 },
  { id: 'C2', title: '10 000',    tickets: 3000 },
  { id: 'C3', title: '10 000',    tickets: 3000 },
];

function pickByTickets(items: Item[]): Item {
  const total = items.reduce((s, it) => s + it.tickets, 0);
  let r = Math.random() * total;
  for (const it of items) {
    if (r < it.tickets) return it;
    r -= it.tickets;
  }
  return items[items.length - 1];
}

function validateInitData(initData: string, botToken: string) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { ok: false, reason: 'no_hash' };

    // data_check_string: all key=value except "hash", sorted and joined with \n
    const dataCheckString = Array.from(params.entries())
      .filter(([k]) => k !== 'hash')
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');

    // secret_key = HMAC_SHA256(botToken, "WebAppData")
    const secret = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calcHash = crypto
      .createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex');

    if (calcHash !== hash) return { ok: false, reason: 'bad_hash' };

    const userStr = params.get('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const userId = user?.id ? String(user.id) : 'guest';

    // опционально: «свежесть» не старше 24 часов
    const authDate = Number(params.get('auth_date') || '0');
    const maxAgeSec = 60 * 60 * 24;
    const ageOk = authDate > 0 && (Date.now() / 1000 - authDate) <= maxAgeSec;

    return { ok: true, userId, ageOk };
  } catch (e) {
    return { ok: false, reason: 'exception' };
  }
}

async function resolveUserId(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  // читаем initData из разных мест (header/body/query)
  let initData = req.headers.get('x-init-data') || '';
  if (!initData) {
    try {
      const body = await req.json();
      if (body?.initData) initData = body.initData as string;
    } catch {}
  }
  if (!initData) initData = req.nextUrl.searchParams.get('initData') || '';

  if (initData && botToken) {
    const res = validateInitData(initData, botToken);
    return { userId: res.ok ? res.userId! : 'guest', validated: res.ok };
  }
  return { userId: 'guest', validated: false };
}

async function handle(req: NextRequest) {
  const { userId, validated } = await resolveUserId(req);
  const prize = pickByTickets(ITEMS);

  const ts = new Date().toISOString();
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.log('[open_case]', {
    method: req.method,
    hasHeader: !!req.headers.get('x-init-data'),
    validated,
    ts,
    reqId,
    userId,
    prizeId: prize.id,
    prizeTitle: prize.title,
  });

  return NextResponse.json({ ok: true, prize, userId });
}

export async function GET(req: NextRequest)  { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
