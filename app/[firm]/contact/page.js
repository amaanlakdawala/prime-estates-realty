import EnquiryForm from '@/components/EnquiryForm';
import { WhatsAppIcon } from '@/components/WhatsAppButton';
import { requireSite } from '@/lib/firm';
import { whatsappLink } from '@/lib/format';

export const metadata = { title: 'Contact us' };
// Cached like the home page (rebuilt every 5 minutes or after the firm's profile changes).
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

export default async function ContactPage({ params }) {
  const site = await requireSite(params);
  const details = [
    site.phoneHref && ['Phone', <a key="p" href={`tel:${site.phoneHref}`} className="hover:text-brand">{site.phoneDisplay}</a>, 'font-display text-2xl font-semibold'],
    site.email && ['Email', <a key="e" href={`mailto:${site.email}`} className="hover:text-brand">{site.email}</a>, 'text-lg font-semibold'],
    site.address && ['Office', site.address, 'text-lg'],
    site.hours && ['Office hours', site.hours, 'text-lg'],
  ].filter(Boolean);

  return (
    <div className="page py-14 sm:py-20">
      <h1 className="animate-fade-up text-4xl font-bold sm:text-5xl">Contact us</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">Call, message on WhatsApp, visit the office, or send the form. We reply within one working day.</p>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-8">
          <dl className="space-y-6">
            {details.map(([label, value, cls]) => (
              <div key={label}>
                <dt className="text-sm text-muted">{label}</dt>
                <dd className={`mt-1 ${cls}`}>{value}</dd>
              </div>
            ))}
          </dl>
          {site.whatsapp && (
            <a href={whatsappLink(site.whatsapp, `Hello ${site.name}, I have a question.`)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
              <WhatsAppIcon size={18} /> Message us on WhatsApp
            </a>
          )}
          {site.mapQuery && (
            <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-line">
              <iframe title="Map of our office" src={`https://maps.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&z=15&output=embed`} className="h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
          )}
        </div>
        <div className="animate-fade-up rounded-3xl border border-line bg-white p-6 shadow-lift [animation-delay:0.15s] sm:p-8">
          <h2 className="text-2xl font-semibold">Send us a message</h2>
          <p className="mt-1 text-muted">Tell us the locality, budget and type of property you are looking for.</p>
          <div className="mt-6">
            <EnquiryForm firmId={site.id} source="contact" submitLabel="Send message" />
          </div>
        </div>
      </div>
    </div>
  );
}
