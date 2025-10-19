import { NextResponse } from 'next/server';

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

export async function GET() {
  const prize = pickByTickets(ITEMS);

  // ----- ЖУРНАЛ В КОНСОЛЬ -----
  const ts = new Date().toISOString();
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`; // простой ID
  console.log('[open_log]', { ts, reqId, prizeId: prize.id, prizeTitle: prize.title });
  // -----------------------------

  return NextResponse.json({ ok: true, msg: prize.title, prize });
}