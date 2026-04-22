'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/tasks', label: 'Aufgaben', icon: '📋' },
  { href: '/shopping', label: 'Einkauf', icon: '🛒' },
  { href: '/profile', label: 'Profil', icon: '👤' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-50 safe-bottom">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {tabs.map(tab => {
          const active = pathname === tab.href || pathname?.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 min-w-[4rem] py-1 transition-all ${
                active ? 'text-primary scale-105' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className={`text-[10px] font-medium ${active ? 'font-bold' : ''}`}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
