'use client';
import { useState } from 'react';

export default function Home() {
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function testOpen() {
    setMsg('');
    setError('');
    try {
      const res = await fetch('/api/open_case'); // GET к нашему серверному файлу
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Ошибка');
      setMsg(data.msg ?? 'ok'); // у нас вернётся "API is alive"
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