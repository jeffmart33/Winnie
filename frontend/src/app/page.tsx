import Link from 'next/link';
import LocatorClient from '@/components/LocatorClient';

export default function HomePage() {
  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 pt-4 text-right">
        <Link href="/admin" className="rounded-lg border border-line bg-panel px-3 py-2 text-sm hover:bg-panelAlt">
          Admin
        </Link>
      </div>
      <LocatorClient />
    </>
  );
}
