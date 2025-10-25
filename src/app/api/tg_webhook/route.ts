// src/app/api/tg_webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // защита секретом (должен совпадать с setWebhook&secret_token=...)
    const required = process.env.TG_WEBHOOK_SECRET || '';
    const got = req.headers.get('x-telegram-bot-api-secret-token') || '';
    if (required && got !== required) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
    const TG_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';

    const update = await req.json();

    // 1) pre_checkout_query — обязательно подтвердить
    const pcq = update?.pre_checkout_query;
    if (pcq && TG_API) {
      // при желании тут можно проверить payload/сумму и отклонить
      const answer = await fetch(`${TG_API}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query_id: pcq.id,
          ok: true, // подтвердили платёж
          // error_message: '…'  // если нужно отклонить
        }),
      });
      const res = await answer.json().catch(() => null);
      console.log('[tg_webhook][pre_checkout_query]: answered', { ok: res?.ok, id: pcq.id });
      // возвращаем 200, чтобы Telegram не ретраил
      return NextResponse.json({ ok: true, answered: true });
    }

    // 2) успешная оплата — начисляем право
    const msg = update?.message;
    const sp = msg?.successful_payment;
    if (sp) {
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
    }

    // прочие апдейты нам не интересны
    return NextResponse.json({ ok: true, skipped: true });
  } catch (e) {
    console.error('[tg_webhook:error]', e);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
