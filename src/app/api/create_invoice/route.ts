// src/app/api/create_invoice/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { parse as parseInitData } from '@tma.js/init-data-node';

const PRICE_STARS = 1; // стоимость в Stars за 1 открытие

async function readInitData(req: NextRequest): Promise<string> {
  // как и в open_case: сначала хедер, потом тело, потом query
  const fromHeader = req.headers.get('x-init-data');
  if (fromHeader) return fromHeader;
  try {
    const body = await req.json();
    if (body?.initData) return String(body.initData);
  } catch {}
  const fromQuery = req.nextUrl.searchParams.get('initData');
  if (fromQuery) return fromQuery;
  return '';
}

export async function POST(req: NextRequest) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: 'no_bot_token' }, { status: 500 });
  }

  const initDataRaw = await readInitData(req);
  const parsed = initDataRaw ? parseInitData(initDataRaw) : undefined;
  const userId = parsed?.user?.id ? String(parsed.user.id) : 'guest';

  // генерируем идемпотентный payload для будущей выдачи права
  const payload = `stars:${userId}:${Date.now()}`;

  // Telegram Stars: currency 'XTR', prices[].amount — в звёздах (целое число)
  const tgBody = {
    title: 'Открытие кейса',
    description: '1 открытие',
    payload,
    currency: 'XTR',
    prices: [{ label: 'Open', amount: PRICE_STARS }],
    // provider_token НЕ нужен для Stars
  };

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tgBody),
  });

  const json = await resp.json();
  if (!json?.ok) {
    console.error('[create_invoice:error]', json);
    return NextResponse.json({ ok: false, error: 'tg_create_invoice_failed', details: json }, { status: 500 });
  }

  const link: string = json.result;
  // вернём ссылку и payload — payload потом применим как req_id в grant_open
  return NextResponse.json({ ok: true, link, payload, userId });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
