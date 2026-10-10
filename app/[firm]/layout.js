import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import { getSiteBySlug } from '@/lib/firm';

// Every firm's public website lives under /<firm slug>/…
export async function generateMetadata({ params }) {
  const site = await getSiteBySlug((await params).firm);
  if (!site) return { title: 'Page not found' };
  return {
    title: { default: `${site.name} | Real estate brokers${site.city ? ` in ${site.city}` : ''}`, template: `%s | ${site.name}` },
    description: site.description,
  };
}

export default async function FirmLayout({ children, params }) {
  const site = await getSiteBySlug((await params).firm);
  if (!site) notFound();

  return (
    <>
      <Header site={site} />
      <main>{children}</main>
      <Footer site={site} />
      <WhatsAppButton site={site} />
    </>
  );
}
