'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SwitchViewButton() {
  const pathname = usePathname();
  const isDev = pathname === '/dev';

  return (
    <Link
      href={isDev ? '/changelog' : '/dev'}
      className="fixed top-6 right-6 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
    >
      {isDev ? 'View Changelog' : 'Switch to Dev'}
    </Link>
  );
}