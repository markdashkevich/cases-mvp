// src/app/api/open_case/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, createHash } from 'crypto';

type Item = { id: string; title: string; tickets: number };

const ITEMS: Item[] = [
  { id: 'L1', title: '1 000 000', tickets: 1 },
  { id: 'R1', title: '500 000',   tickets: 2 },
  { id: 'R2', title: '300 000',   tickets: 4 },
  { id: 'C1', title: '10 000',    tickets: 3000 },
  { id: 'C2', title: '10 000',    tickets: 3000 },
  { id: 'C3', title: '10 000',    tickets: 3000 },
];

function pickByTickets(items: Item[]) {
  const total = items.reduce((s, it) => s + it.tickets, 0);
  let r = Math.random() * total;
  for (const it of items) {
    if (r < it.tickets) return it;
    r -= it.tickets;
  }
  return items[items.length - 1];
}

function verifyInitData(initData: string, botToken: string): { valid: boolean; userId: string } {
  try {
    if (!initData || !botToken) return { valid: false, userId: 'guest' };

    const params = new URLSearchParams(initData);
    const hash = params.get('hash') || '';
    params.delete('hash');

    const pairs: string[] = [];
    params.forEach((val, key) => {
      // Telegram требует сортировку по ключу, формат "key=value"
      if (val !== undefined && val !== null) pairs.push(`${key}=${val}`);
    });
    pairs.sort();
    const checkString = pairs.join('\n');

    const secret = createHash('sha256').update(botToken).digest();
    const hmac = createHmac('sha256', secret).update(checkString).digest('hex');
    const valid = hmac === hash;

    let userId = 'guest';
    const userStr = params.get('user');
    if (userStr) {
      const u = JSON.parse(userStr);
      if (u?.id) userId = String(u.id);
    }
    return { valid, userId };
  } catch {
    return { valid: false, userId: 'guest' };
  }
}

async function readInitData(req: NextRequest): Promise<string> {
  // initData может прийти в теле, заголовке или query
  try {
    const body = await req.json();
    if (body?.initData) return String(body.initData);
  } catch {}
  const fromHeader = req.headers.get('x-init-data');
  if (fromHeader) return fromHeader;
  const fromQuery = req.nextUrl.searchParams.get('initData');
  if (fromQuery) return fromQuery;
  return '';
}

export async function POST(req: NextRequest) {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  const initData = await readInitData(req);
  const { valid: isValid, userId } = verifyInitData(initData, BOT_TOKEN);

  const platform = req.headers.get('x-tg-platform') || null;
  const version  = req.headers.get('x-tg-version')  || null;

  const ts = new Date().toISOString();
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ua = req.headers.get('user-agent') || '';

  let ok = true;
  let balance: number | null = null;

  if (userId !== 'guest') {
    const { data: consumeRows, error: consumeErr } = await supabase.rpc('consume_open', {
      p_user_id: userId,
      p_req_id : reqId,
    });
    if (consumeErr) {
      console.error('[consume_open:error]', consumeErr);
      return NextResponse.json({ ok: false, error: 'consume_failed' }, { status: 500 });
    }
    const consume = Array.isArray(consumeRows) ? consumeRows[0] : consumeRows;
    ok = !!consume?.ok;
    balance = typeof consume?.balance === 'number' ? consume.balance : null;

    if (!ok) {
      await supabase.from('open_logs').insert({
        ts, req_id: reqId, user_id: userId,
        prize_id: null, prize_title: null,
        validated: isValid,
        platform, version, source: ua,
      });
      return NextResponse.json({ ok: false, error: 'no_rights', balance: balance ?? 0 }, { status: 402 });
    }
  }

  const prize = pickByTickets(ITEMS);

  await supabase.from('open_logs').insert({
    ts, req_id: reqId, user_id: userId,
    prize_id: prize.id, prize_title: prize.title,
    validated: isValid,
    platform, version, source: ua,
  });

  console.log('[open_case]', {
    method: 'POST',
    hasHeader: !!req.headers.get('x-init-data'),
    validated: isValid,
    ts, reqId, userId, prizeId: prize.id, prizeTitle: prize.title,
  });

  return NextResponse.json({ ok: true, prize, userId, balance, validated: isValid });
}

export async function GET(req: NextRequest) {
  return POST(req);
}

