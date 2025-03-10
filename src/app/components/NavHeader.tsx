'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavHeader() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <div className="border-b mb-6">
      <div className="max-w-3xl mx-auto px-6">
        <div className="flex items-center h-16 -mb-px">
          <Link
            href="/dev"
            className={`px-4 h-full inline-flex items-center border-b-2 font-medium text-sm ${
              isActive('/dev')
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Developer
          </Link>
          <Link
            href="/changelog"
            className={`ml-8 px-4 h-full inline-flex items-center border-b-2 font-medium text-sm ${
              isActive('/changelog')
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Changelog
          </Link>
        </div>
      </div>
    </div>
  );
}