import Logo from '@/components/Logo';

// Shared centered card used by the sign-in and password reset pages.
export default function AuthCard({ title, subtitle, children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone px-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="rounded-xl border border-line bg-white p-6 sm:p-7">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
