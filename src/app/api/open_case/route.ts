import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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

async function resolveUserId(req: NextRequest): Promise<string> {
  // 1) тело
  try {
    const body = await req.json();
    if (body?.initData) return userIdFromInitData(body.initData as string);
  } catch { /* нет/не JSON — ок */ }

  // 2) заголовок
  const fromHeader = req.headers.get('x-init-data');
  if (fromHeader) return userIdFromInitData(fromHeader);

  // 3) query
  const fromQuery = req.nextUrl.searchParams.get('initData');
  if (fromQuery) return userIdFromInitData(fromQuery);

  return 'guest';
}

async function handle(req: NextRequest) {
  const userId = await resolveUserId(req);
  const prize = pickByTickets(ITEMS);

  const ts = new Date().toISOString();
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.log('[open_case]', {
    method: req.method,
    hasHeader: !!req.headers.get('x-init-data'),
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
