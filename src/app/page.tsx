'use client';
import { useState, useEffect, useCallback } from 'react';

type Dbg = {
  hasTg: boolean;
  hasInit: boolean;
  initLen: number;
  platform?: string;
  version?: string;
  scriptLoaded?: boolean;
  href?: string;
};

export default function Home() {
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [dbg, setDbg] = useState<Dbg>({ hasTg: false, hasInit: false, initLen: 0 });

  const refreshDbg = () => {
    const tg = (window as any)?.Telegram?.WebApp;
    const initData: string = tg?.initData || '';
    tg?.ready?.();
    setDbg(d => ({
      ...d,
      hasTg: !!tg,
      hasInit: !!initData,
      initLen: initData.length || 0,
      platform: tg?.platform,
      version: tg?.version,
      href: window.location.href,
    }));
  };

  useEffect(() => {
    refreshDbg();
  }, []);

  // подгружаем SDK вручную (надёжно для tdesktop/ios/android)
  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.async = true;
    s.onload = () => {
      setDbg(d => ({ ...d, scriptLoaded: true }));
      refreshDbg();
    };
    document.head.appendChild(s);
    return () => {
      document.head.removeChild(s);
    };
  }, []);

  const testOpen = useCallback(async () => {
    setMsg('');
    setError('');
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      const initData: string = tg?.initData || '';
      const platform = tg?.platform || '';
      const version = tg?.version || '';

      const res = await fetch('/api/open_case', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // дублируем initData в заголовке
          'x-init-data': initData,
          'x-tg-platform': platform,
          'x-tg-version': version,
        },
        // и в теле — на случай, если хедер где-то потеряется
        body: JSON.stringify({ initData, platform, version }),
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

      {/* небольшой отладчик снизу — потом уберём */}
      <div style={{ position: 'fixed', bottom: 12, left: 12, fontSize: 11, opacity: 0.85, maxWidth: 380, lineHeight: 1.2 }}>
        dbg → tg:{String(dbg.hasTg)} | init:{String(dbg.hasInit)} | len:{dbg.initLen} | {dbg.platform ?? '-'} {dbg.version ?? ''}
        <br />
        scriptLoaded:{String(dbg.scriptLoaded)}
        <br />
        href:{dbg.href}
      </div>
    </main>
  );
}
