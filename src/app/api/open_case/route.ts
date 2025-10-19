import { NextRequest, NextResponse } from 'next/server';

type Item = { id: string; title: string; tickets: number };

const ITEMS: Item[] = [
  { id: 'L1', title: '1 000 000', tickets: 1 },
  { id: 'R1', title: '500 000',   tickets: 2 },
  { id: 'R2', title: '300 000',   tickets: 4 },
  { id: 'C1', title: '10 000',    tickets: 3000 },
  { id: 'C2', title: '10 000',    tickets: 3000 },
  { id: 'C3', title: '10 000',    tickets: 3000 },
];

// выбор приза по "билетам"
function pickByTickets(items: Item[]) {
  const total = items.reduce((s, it) => s + it.tickets, 0);
  let r = Math.random() * total;
  for (const it of items) {
    if (r < it.tickets) return it;
    r -= it.tickets;
  }
  return items[items.length - 1];
}

// достаём userId из initData (если есть)
function userIdFromInitData(initData?: string): string {
  try {
    if (!initData) return 'guest';
    const p = new URLSearchParams(initData);
    const userStr = p.get('user');
    if (!userStr) return 'guest';
    const user = JSON.parse(userStr);
    return user?.id ? String(user.id) : 'guest';
  } catch {
    return 'guest';
  }
}

// читаем initData из разных мест (body / header / query)
async function resolveUserId(req: NextRequest): Promise<string> {
  // 1) тело POST: { initData: "..." }
  try {
    const body = await req.json();
    if (body?.initData) return userIdFromInitData(body.initData as string);
  } catch {
    /* пустое тело/GET — игнорируем */
  }

  // 2) заголовок X-Init-Data
  const fromHeader = req.headers.get('x-init-data');
  if (fromHeader) return userIdFromInitData(fromHeader);

  // 3) query ?initData=...
  const fromQuery = req.nextUrl.searchParams.get('initData');
  if (fromQuery) return userIdFromInitData(fromQuery);

  // 4) нет ничего — гость
  return 'guest';
}

async function handle(req: NextRequest) {
  const userId = await resolveUserId(req);
  const prize = pickByTickets(ITEMS);

  // журнал
  const ts = new Date().toISOString();
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log('[open_log]', { ts, reqId, userId, prizeId: prize.id, prizeTitle: prize.title });

  return NextResponse.json({ ok: true, prize, userId });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
