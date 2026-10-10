'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NotFound() {
  // /seabreeze/properties/<id> -> /seabreeze/properties
  const propertiesUrl = usePathname().split('/').slice(0, 3).join('/');
  return (
    <div className="page py-24 text-center">
      <h1 className="text-3xl font-semibold">This property is no longer available</h1>
      <p className="mt-3 text-muted">It may have been sold or rented. Browse similar properties below.</p>
      <Link href={propertiesUrl} className="btn-primary mt-6">Browse properties</Link>
    </div>
  );
}
