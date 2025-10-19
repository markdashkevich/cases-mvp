'use client';
import { useState } from 'react';

export default function Home() {
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function testOpen() {
  setMsg('');
  setError('');
  try {
    const tg = (window as any).Telegram?.WebApp;
    const initData = tg?.initData || ''; // в Телеге тут будут данные пользователя

    const res = await fetch('/api/open_case', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-init-data': initData, // передаём на сервер
      },
      body: JSON.stringify({}), // тело нам не нужно, всё в заголовке
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? 'Ошибка');
    setMsg(data.prize?.title ?? 'ok');
  } catch (e: any) {
    setError(e.message || 'Не получилось обратиться к API');
  }
}


  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', gap: 16 }}>
      <h1 style={{ margin: 0 }}>Cases MVP</h1>

      <button
        onClick={testOpen}
        style={{
          padding: '12px 20px',
          border: 'none',
          borderRadius: 12,
          background: '#4F46E5',
          color: '#fff',
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        Тест: открыть API
      </button>

      {msg && <div>Ответ сервера: <b>{msg}</b></div>}
      {error && <div style={{ color: 'crimson' }}>Ошибка: {error}</div>}
    </main>
  );
}