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
    const hash = (params.get('hash') || '').trim();
    const hashLower = hash.toLowerCase();

    // какие ключи реально пришли
    const keys: string[] = [];
    params.forEach((_, k) => keys.push(k));
    keys.sort();

    // decoded checkString (URLSearchParams уже декодирует значения)
    const pairsDec: string[] = [];
    params.forEach((val, key) => {
      if (key === 'hash' || key === 'signature') return;
      pairsDec.push(`${key}=${val}`);
    });
    pairsDec.sort();
    const checkDec = pairsDec.join('\n');

    // raw checkString (значения как в исходной строке)
    const kvRaw: Array<[string, string]> = [];
    for (const p of initData.split('&')) {
      const i = p.indexOf('=');
      if (i < 0) continue;
      const k = decodeURIComponent(p.slice(0, i)); // ключ для сортировки
      const v = p.slice(i + 1);                    // значение НЕ декодируем
      if (k === 'hash' || k === 'signature') continue;
      kvRaw.push([k, v]);
    }
    kvRaw.sort(([a], [b]) => a.localeCompare(b));
    const checkRaw = kvRaw.map(([k, v]) => `${k}=${v}`).join('\n');

    // три "секрета"
    const secretLogin   = createHash('sha256').update(botToken).digest();                 // login-widget
    const secretWebAppA = createHmac('sha256', 'WebAppData').update(botToken).digest();   // key="WebAppData", msg=botToken
    const secretWebAppB = createHmac('sha256', botToken).update('WebAppData').digest();   // key=botToken, msg="WebAppData"

    // считаем 6 вариантов
    const h1 = createHmac('sha256', secretLogin).update(checkDec).digest('hex');
    const h2 = createHmac('sha256', secretLogin).update(checkRaw).digest('hex');
    const h3 = createHmac('sha256', secretWebAppA).update(checkDec).digest('hex');
    const h4 = createHmac('sha256', secretWebAppA).update(checkRaw).digest('hex');
    const h5 = createHmac('sha256', secretWebAppB).update(checkDec).digest('hex');
    const h6 = createHmac('sha256', secretWebAppB).update(checkRaw).digest('hex');

    let mode = '';
    let valid = false;
    if (h3 === hashLower) { valid = true; mode = 'webappA+decoded'; }
    else if (h4 === hashLower) { valid = true; mode = 'webappA+raw'; }
    else if (h1 === hashLower) { valid = true; mode = 'login+decoded'; }
    else if (h2 === hashLower) { valid = true; mode = 'login+raw'; }
    else if (h5 === hashLower) { valid = true; mode = 'webappB+decoded'; }
    else if (h6 === hashLower) { valid = true; mode = 'webappB+raw'; }

    // подробный лог (без утечек всей строки)
    const isHex = /^[0-9a-fA-F]+$/.test(hash);
    console.log('[initData:verify]', {
      len: initData.length,
      keys,
      hashLen: hash.length,
      hashIsHex: isHex,
      mode,
      match: {
        h1: h1.slice(0, 8) === hashLower.slice(0, 8),
        h2: h2.slice(0, 8) === hashLower.slice(0, 8),
        h3: h3.slice(0, 8) === hashLower.slice(0, 8),
        h4: h4.slice(0, 8) === hashLower.slice(0, 8),
        h5: h5.slice(0, 8) === hashLower.slice(0, 8),
        h6: h6.slice(0, 8) === hashLower.slice(0, 8),
      },
      hashHead: hashLower.slice(0, 8),
      h1Head: h1.slice(0, 8),
      h2Head: h2.slice(0, 8),
      h3Head: h3.slice(0, 8),
      h4Head: h4.slice(0, 8),
      h5Head: h5.slice(0, 8),
      h6Head: h6.slice(0, 8),
      sampleDec: checkDec.slice(0, 120),
      sampleRaw: checkRaw.slice(0, 120),
    });

    // userId
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
