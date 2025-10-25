// src/app/api/tg_webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // Опциональная защита вебхука секретом (добавим позже в переменные окружения)
    const required = process.env.TG_WEBHOOK_SECRET || '';
    const got = req.headers.get('x-telegram-bot-api-secret-token') || '';
    if (required && got !== required) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const update = await req.json();
    const msg = update?.message;
    const sp = msg?.successful_payment;
    if (!sp) {
      // неинтересные апдейты просто подтверждаем
      return NextResponse.json({ ok: true, skipped: true });
    }

    const userId = String(msg.from?.id ?? '');
    const payload: string = String(sp.invoice_payload ?? '');
    if (!userId || !payload) {
      return NextResponse.json({ ok: false, error: 'bad_payload' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // grant_open(p_user_id text, p_delta int, p_reason text, p_req_id text)
    const { data, error } = await supabase.rpc('grant_open', {
      p_user_id: userId,
      p_delta: 1,
      p_reason: 'stars',
      p_req_id: payload, // идемпотентность по payload
    });

    if (error) {
      console.error('[tg_webhook][grant_open:error]', error);
      return NextResponse.json({ ok: false, error: 'grant_failed' }, { status: 500 });
    }

    console.log('[tg_webhook] +1 right', { userId, payload, newBalance: data });
    return NextResponse.json({ ok: true, userId, newBalance: data });
  } catch (e) {
    console.error('[tg_webhook:error]', e);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
