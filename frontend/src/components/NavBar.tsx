'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const pathname = usePathname();

  const items = [
    {
      href: '/dashboard',
      label: 'Home',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-radler-green-500' : 'text-radler-ink-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: '/book',
      label: 'Buchen',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-radler-green-500' : 'text-radler-ink-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      href: '/history',
      label: 'Historie',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-radler-green-500' : 'text-radler-ink-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: '/profile',
      label: 'Profil',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-radler-green-500' : 'text-radler-ink-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-radler-ink-200 z-50 safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
        {items.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-1 py-2 px-4">
              {icon(active)}
              <span className={`font-body font-medium text-[11px] ${active ? 'text-radler-green-500' : 'text-radler-ink-400'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
