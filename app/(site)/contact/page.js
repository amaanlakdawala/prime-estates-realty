import EnquiryForm from '@/components/EnquiryForm';
import { WhatsAppIcon } from '@/components/WhatsAppButton';
import { site } from '@/lib/site';
import { whatsappLink } from '@/lib/format';

export const metadata = { title: 'Contact us' };

export default function ContactPage() {
  return (
    <div className="page py-14 sm:py-20">
      <h1 className="text-4xl font-semibold sm:text-5xl">Contact us</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">Call, message on WhatsApp, visit the office, or send the form. We reply within one working day.</p>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-8">
          <dl className="space-y-6">
            <div>
              <dt className="text-sm text-muted">Phone</dt>
              <dd className="mt-1 font-display text-2xl font-semibold"><a href={`tel:${site.phoneHref}`} className="hover:text-teal">{site.phoneDisplay}</a></dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Email</dt>
              <dd className="mt-1 text-lg font-semibold"><a href={`mailto:${site.email}`} className="hover:text-teal">{site.email}</a></dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Office</dt>
              <dd className="mt-1 text-lg">{site.address}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Office hours</dt>
              <dd className="mt-1 text-lg">{site.hours}</dd>
            </div>
          </dl>
          <a href={whatsappLink(site.whatsapp, `Hello ${site.name}, I have a question.`)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
            <WhatsAppIcon size={18} /> Message us on WhatsApp
          </a>
          <div className="aspect-[4/3] overflow-hidden rounded-xl border border-line">
            <iframe title="Map of our office" src={`https://maps.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&z=15&output=embed`} className="h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        </div>
        <div className="rounded-xl border border-line p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Send us a message</h2>
          <p className="mt-1 text-muted">Tell us the locality, budget and type of property you are looking for.</p>
          <div className="mt-6">
            <EnquiryForm source="contact" submitLabel="Send message" />
          </div>
        </div>
      </div>
    </div>
  );
}
