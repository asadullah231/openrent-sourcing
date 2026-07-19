import './globals.css';
import Link from 'next/link';
import { Home, ListChecks, Settings, Send } from 'lucide-react';

export const metadata = {
  title: 'OpenRent Sourcing — Control Panel',
  description: 'Property sourcing bot dashboard',
};

const nav = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/queue', label: 'Viewing Queue', icon: Send },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="min-h-screen flex">
          <aside className="w-56 border-r border-border p-4 space-y-1 shrink-0">
            <div className="flex items-center gap-2 px-2 py-3 mb-2">
              <ListChecks className="h-5 w-5 text-primary" />
              <span className="font-semibold">OpenRent Bot</span>
            </div>
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-card transition-colors"
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
            <div className="pt-4 mt-4 border-t border-border px-3 text-xs text-muted">
              SaaS: har user apne login/session pe chalta hai.
            </div>
          </aside>
          <main className="flex-1 p-8 max-w-6xl">{children}</main>
        </div>
      </body>
    </html>
  );
}
