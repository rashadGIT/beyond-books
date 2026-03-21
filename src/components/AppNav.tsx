'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bot, FileSpreadsheet, GitBranch, BookOpen, Mail, Settings, LogOut } from 'lucide-react';

const NAV_LINKS = [
  { href: '/',             label: 'AI Assistant',     icon: Bot,             activeColor: 'text-blue-400',    hoverColor: 'hover:text-blue-400' },
  { href: '/spreadsheet',  label: 'Spreadsheet Sync', icon: FileSpreadsheet, activeColor: 'text-emerald-400', hoverColor: 'hover:text-emerald-400' },
  { href: '/allocations',  label: 'Allocations',      icon: GitBranch,       activeColor: 'text-purple-400',  hoverColor: 'hover:text-purple-400' },
  { href: '/ledger',       label: 'Ledger',           icon: BookOpen,        activeColor: 'text-emerald-400', hoverColor: 'hover:text-emerald-400' },
  { href: '/letters',      label: 'Donation Letters', icon: Mail,            activeColor: 'text-sky-400',     hoverColor: 'hover:text-sky-400' },
  { href: '/settings',     label: 'Settings',         icon: Settings,        activeColor: 'text-slate-200',   hoverColor: 'hover:text-white' },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex items-center gap-1">
      {NAV_LINKS.map(({ href, label, icon: Icon, activeColor, hoverColor }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={`p-2 rounded-lg transition-all hover:bg-slate-800 ${isActive ? activeColor : `text-slate-500 ${hoverColor}`}`}
          >
            <Icon className="w-4 h-4" />
          </Link>
        );
      })}
      <button
        onClick={async () => {
          await fetch('/api/auth/logout', { method: 'POST' });
          router.push('/sign-in');
        }}
        title="Sign out"
        className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </nav>
  );
}
