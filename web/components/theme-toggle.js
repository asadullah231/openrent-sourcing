'use client';

import { useEffect, useState } from 'react';

// Theme toggle. Asli kaam <html data-theme="..."> set karna hai — baqi sab
// CSS variables khud sambhal lete hain (globals.css).
//
// Ek zaroori baat: pehla render server pe hota hai, jahan localStorage nahi
// hota. Is liye server hamesha "dark" maan kar likhta hai. Agar hum foran
// asli theme ka icon dikha dein to React hydration mismatch pe chilata hai.
// Isi liye `ready` — jab tak client pe theme pata nahi chalta, icon khali
// rehta hai (jagah phir bhi ghairi rehti hai, taake rail hile na).
export function ThemeToggle() {
  const [theme, setTheme] = useState('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // layout ki script pehle hi data-theme laga chuki hoti hai — wahi sach hai
    setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    setReady(true);
  }, []);

  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // private mode / storage band — theme phir bhi is tab me chalega,
      // bas agli baar yaad nahi rahega. Isi liye crash nahi karate.
    }
  };

  return (
    <button
      className="theme-toggle"
      onClick={flip}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      <span aria-hidden="true" style={{ fontSize: 14, width: 16, textAlign: 'center' }}>
        {ready ? (theme === 'dark' ? '☀' : '☾') : ''}
      </span>
      <span>{ready ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : 'Theme'}</span>
    </button>
  );
}
