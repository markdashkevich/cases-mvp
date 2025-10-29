// src/app/api/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Init from '@tma.js/init-data-node';

// читаем initData из тела / заголовка / query
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

function verifyInitData(initData: string, botToken: string): { valid: boolean; userId: string } {
  try {
    if (!initData || !botToken) return { valid: false, userId: 'guest' };

    const parsed = Init.parse(initData);

    let isValid = false;
    try {
      // бросит ошибку, если подпись неверная
      Init.validate(initData, botToken);
      isValid = true;
    } catch {
      isValid = false;
    }

    const userId = parsed.user?.id ? String(parsed.user.id) : 'guest';
    return { valid: isValid, userId };
  } catch {
    return { valid: false, userId: 'guest' };
  }
}


async function handler(req: NextRequest) {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const initData = await readInitData(req);
  const { valid: isValid, userId } = verifyInitData(initData, BOT_TOKEN);

  // гостям отдаём 0, но не падаем
  if (userId === 'guest') {
    return NextResponse.json({ ok: true, balance: 0, userId, validated: isValid });
  }

  const { data, error } = await supabase
    .from('open_rights')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle(); // если записи нет — вернётся null

  if (error) {
    console.error('[balance:error]', error);
    return NextResponse.json({ ok: false, error: 'db_failed' }, { status: 500 });
  }

  const balance = data?.balance ?? 0;
  return NextResponse.json({ ok: true, balance, userId, validated: isValid });
}

export async function POST(req: NextRequest) { return handler(req); }
export async function GET(req: NextRequest)  { return handler(req); }
