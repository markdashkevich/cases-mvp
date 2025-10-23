'use client';
import { useState, useEffect, useCallback } from 'react';

export default function Home() {
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [dbg, setDbg] = useState<{hasTg:boolean; hasInit:boolean; initLen:number; platform?:string; version?:string}>({
    hasTg: false, hasInit: false, initLen: 0,
  });

  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    const initData: string = tg?.initData || '';
    // на всякий случай
    tg?.ready?.();

    setDbg({
      hasTg: !!tg,
      hasInit: !!initData,
      initLen: initData.length || 0,
      platform: tg?.platform,
      version: tg?.version,
    });
  }, []);

  const testOpen = useCallback(async () => {
    setMsg('');
    setError('');
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      const initData: string = tg?.initData || '';

      const res = await fetch('/api/open_case', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-init-data': initData,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error ?? 'Ошибка');
      setMsg(`${data.prize?.title} (user: ${data.userId ?? 'guest'})`);
    } catch (e: any) {
      setError(e?.message ?? 'Не получилось обратиться к API');
    }
  }, []);

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

      <div style={{ position:'fixed', bottom: 12, left: 12, fontSize: 12, opacity: 0.8 }}>
        dbg → tg:{String(dbg.hasTg)} | init:{String(dbg.hasInit)} | len:{dbg.initLen} | {dbg.platform ?? '-'} {dbg.version ?? ''}
      </div>
    </main>
  );
}
