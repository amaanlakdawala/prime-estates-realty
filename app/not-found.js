import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-4xl font-semibold">Page not found</h1>
        <p className="mt-3 text-muted">The link may be broken, or the page may have moved.</p>
        <Link href="/" className="btn-primary mt-6">Go to the home page</Link>
      </div>
    </main>
  );
}
