import Image from 'next/image';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import ContactForm from '@/components/home/ContactForm';
import { DEFAULT_FIRM_SLUG } from '@/lib/site';
import desktopShot from '@/public/home/demo-desktop.png';
import phoneShot from '@/public/home/demo-phone.png';

// The platform's own home page: Amaan's services for Mumbai brokerages. Firm websites live at /<slug>,
// the demo firm at /prime-estates.
export const metadata = {
  title: { absolute: 'Amaan | Websites and AI calling for Mumbai property brokers' },
  description: 'A property website in your firm’s name, one-click Instagram reels and Riya, an AI assistant that calls every enquiry back within a minute in Hindi, English or Hinglish.',
};

const PHONE_DISPLAY = '+91 80975 46742';
const WHATSAPP = `https://wa.me/918097546742?text=${encodeURIComponent('Hi Amaan, I would like a demo for my brokerage.')}`;
const DEMO = `/${DEFAULT_FIRM_SLUG}`;

const Check = ({ className = 'text-accent' }) => (
  <svg viewBox="0 0 20 20" fill="none" className={`h-5 w-5 shrink-0 ${className}`} aria-hidden="true">
    <path d="M5 10.5l3.2 3.2L15 6.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PROBLEMS = [
  ['Portal leads are shared with five brokers.', 'Your own website sends every enquiry to you alone.'],
  ['A buyer who waits an hour calls someone else.', 'Riya calls them back in about a minute, 9 am to 9 pm.'],
  ['Posting listings eats your evening.', 'A reel and a WhatsApp write-up are ready in one click.'],
];

const SERVICES = [
  {
    tag: 'Website',
    title: 'A property website in your firm’s name',
    points: [
      'Six pages: home, properties, property pages, about, services, contact',
      'Search by area, BHK and budget; gallery, map and EMI calculator on every property',
      'WhatsApp and call buttons, enquiry and site-visit forms that come straight to you',
      'Your MahaRERA numbers shown; add and close listings from your phone',
    ],
  },
  {
    tag: 'Instagram',
    title: 'Reels for every listing, in one click',
    points: [
      'A vertical reel from the listing’s photos with the price, area and your number',
      'A ready caption with hashtags, and a neat WhatsApp write-up',
      'No editing app, no designer, nothing to install',
    ],
  },
  {
    tag: 'AI calling',
    title: 'Riya calls every enquiry back',
    points: [
      'Calls new website enquiries about a minute after they arrive, or any list you upload',
      'Speaks Hindi, English or Hinglish and checks your live listings while she talks',
      'Offers real properties, books a site visit or a callback, and saves the conversation',
      'Introduces herself as your virtual assistant; never calls people who say no',
    ],
  },
];

const STEPS = [
  ['A 10-minute demo', 'On a call or on WhatsApp, I show you the website, reels and Riya on a sample brokerage.'],
  ['Set up the same day', 'I put in your firm’s name, logo, areas, contact details and first listings.'],
  ['You sell, it follows up', 'You add listings from your phone; enquiries reach you and Riya calls them back.'],
];

const FAQ = [
  ['Do I need any technical skills?', 'No. I set everything up, and you manage listings, enquiries and calls from your phone in a simple admin panel.'],
  ['Does Riya pretend to be a person?', 'No. She introduces herself as your firm’s virtual assistant. If someone asks, she says so and offers to have your team call them.'],
  ['When does she call, and in which language?', 'Only between 9 am and 9 pm, in Hindi, English or Hinglish, whichever the caller speaks. Anyone who asks not to be called is never called again.'],
  ['Who can see my listings and enquiries?', 'Only you and your team. Every firm’s data is kept separate in the database, and private listings never appear on your website.'],
  ['How much does it cost?', 'Simple monthly or yearly plans for the website, with AI calling as an optional add-on. Message me on WhatsApp and I’ll share the prices for your brokerage.'],
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand font-display text-sm font-bold text-white">A</span>
            <span className="font-display text-[17px] font-bold">Amaan</span>
          </a>
          <nav className="hidden items-center gap-7 text-[15px] font-medium text-muted md:flex">
            <a href="#services" className="hover:text-ink">Services</a>
            <a href="#demo" className="hover:text-ink">See it working</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-4 py-2.5">WhatsApp me</a>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden bg-ink text-white">
          <div className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand/30 blur-3xl animate-glow" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-page items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div className="animate-fade-up">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                For Mumbai real estate brokers
              </p>
              <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                Your own property website, and an AI assistant that calls every enquiry back in a minute.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/75">
                I&apos;m Amaan. I set up brokerages with a website in their own name, one-click Instagram reels and Riya, an AI calling
                assistant who speaks Hindi, English and Hinglish. Live the same day, run from your phone.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-6 py-3.5 text-base">WhatsApp me for a demo</a>
                <Link href={DEMO} className="btn-ghost-light px-6 py-3.5 text-base">See a sample website →</Link>
              </div>
              <ul className="mt-8 grid gap-2.5 text-[15px] text-white/80 sm:grid-cols-3">
                {['No technical skills needed', 'Set up the same day', 'Enquiries come to you alone'].map((t) => (
                  <li key={t} className="flex items-center gap-2"><Check />{t}</li>
                ))}
              </ul>
            </div>
            <div className="relative animate-fade-in">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-soft shadow-lift">
                <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                  <span className="ml-3 truncate rounded-md bg-white/10 px-3 py-0.5 text-xs text-white/60">your-brokerage website</span>
                </div>
                <Image src={desktopShot} alt="A sample brokerage website made with the platform" sizes="(min-width: 1024px) 560px, 100vw" priority className="h-auto w-full" />
              </div>
              <div className="absolute -bottom-12 -right-2 hidden w-24 overflow-hidden rounded-[1.2rem] border-4 border-ink-soft shadow-lift sm:block lg:-right-6 lg:w-28">
                <Image src={phoneShot} alt="The same website on a phone" sizes="144px" className="h-auto w-full" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-line bg-mist">
          <div className="mx-auto grid max-w-page gap-4 px-4 py-12 sm:px-6 md:grid-cols-3">
            {PROBLEMS.map(([problem, answer], i) => (
              <Reveal key={problem} delay={i * 80} className="rounded-2xl bg-white p-6 shadow-card">
                <p className="font-semibold text-ink">{problem}</p>
                <p className="mt-2 flex gap-2 text-muted"><Check className="text-brand" />{answer}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="services" className="scroll-mt-20">
          <div className="mx-auto max-w-page px-4 py-20 sm:px-6">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">What you get</p>
              <h2 className="section-title mt-2">Everything a brokerage needs online, set up for you</h2>
            </Reveal>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {SERVICES.map((s, i) => (
                <Reveal key={s.tag} delay={i * 100} className={`flex flex-col rounded-2xl border p-6 ${s.tag === 'AI calling' ? 'border-brand bg-brand-light/50' : 'border-line bg-white'} shadow-card`}>
                  <span className="w-fit rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">{s.tag}</span>
                  <h3 className="mt-4 font-display text-xl font-bold">{s.title}</h3>
                  <ul className="mt-4 space-y-2.5 text-[15px] text-ink/80">
                    {s.points.map((p) => <li key={p} className="flex gap-2"><Check className="mt-0.5 text-brand" />{p}</li>)}
                  </ul>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="demo" className="scroll-mt-20 bg-ink text-white">
          <div className="mx-auto max-w-page px-4 py-20 sm:px-6">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">See it working</p>
              <h2 className="section-title mt-2">A real website, a real reel, a real call</h2>
              <p className="mt-3 text-white/70">Everything below was made with the platform for a sample brokerage, Prime Estates Realty.</p>
            </Reveal>
            <div className="mt-10 grid gap-6 lg:grid-cols-[1.25fr_0.6fr_1fr]">
              <Reveal className="flex flex-col rounded-2xl border border-white/10 bg-ink-soft p-5">
                <p className="font-semibold">Sample website</p>
                <Link href={DEMO} className="mt-3 block overflow-hidden rounded-xl border border-white/10 transition hover:opacity-90">
                  <Image src={desktopShot} alt="Prime Estates Realty sample website" sizes="(min-width: 1024px) 480px, 100vw" className="h-auto w-full" />
                </Link>
                <Link href={DEMO} className="btn-ghost-light mt-4 w-fit">Open the sample website →</Link>
              </Reveal>
              <Reveal delay={100} className="flex flex-col rounded-2xl border border-white/10 bg-ink-soft p-5">
                <p className="font-semibold">Instagram reel</p>
                <video className="mx-auto mt-3 w-full max-w-[260px] rounded-xl" controls preload="none" playsInline poster="/home/reel-poster.png" src="/demo/sample-reel.mp4">
                  <track kind="captions" />
                </video>
                <p className="mt-3 text-sm text-white/60">Made in about 3 seconds from a listing&apos;s photos.</p>
              </Reveal>
              <Reveal delay={200} className="flex flex-col rounded-2xl border border-white/10 bg-ink-soft p-5">
                <p className="font-semibold">Riya calls a website enquiry</p>
                <video className="mt-3 w-full rounded-xl" controls preload="none" playsInline poster="/home/call-poster.png" src="/demo/sample-ai-call.mp4">
                  <track kind="captions" />
                </video>
                <p className="mt-3 text-sm text-white/60">A real 3-minute call in Hinglish, with the conversation shown as captions.</p>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-20">
          <div className="mx-auto max-w-page px-4 py-20 sm:px-6">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">How it works</p>
              <h2 className="section-title mt-2">Live in a day, with no technical work on your side</h2>
            </Reveal>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {STEPS.map(([title, text], i) => (
                <Reveal as="li" key={title} delay={i * 100} className="rounded-2xl border border-line bg-white p-6 shadow-card">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand font-display font-bold text-white">{i + 1}</span>
                  <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-muted">{text}</p>
                </Reveal>
              ))}
            </ol>
            <Reveal className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl bg-brand-light p-6 sm:flex-row sm:items-center sm:p-8">
              <div>
                <h3 className="font-display text-xl font-bold">Simple monthly or yearly plans</h3>
                <p className="mt-1 max-w-xl text-ink/75">The website plan includes reels and WhatsApp write-ups; AI calling is an optional add-on. Message me for prices for your brokerage.</p>
              </div>
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn-whatsapp shrink-0 px-6 py-3.5">Ask for prices</a>
            </Reveal>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-y border-line bg-mist">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <Reveal><h2 className="section-title">Questions brokers ask</h2></Reveal>
            <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {q}
                    <span className="text-xl text-brand transition group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-2 text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-20">
          <div className="mx-auto grid max-w-page gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Talk to me</p>
              <h2 className="section-title mt-2">See it for your brokerage</h2>
              <p className="mt-3 max-w-md text-muted">Tell me a little about your firm and I&apos;ll show you how your website and Riya would work, in 10 minutes.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">WhatsApp {PHONE_DISPLAY}</a>
                <a href="tel:+918097546742" className="btn-outline">Call me</a>
              </div>
            </Reveal>
            <Reveal delay={100}><ContactForm /></Reveal>
          </div>
        </section>
      </main>

      <footer className="bg-ink text-white/70">
        <div className="mx-auto flex max-w-page flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Amaan · Websites and AI calling for Mumbai property brokers</p>
          <div className="flex gap-5">
            <Link href={DEMO} className="hover:text-white">Sample website</Link>
            <Link href="/login" className="hover:text-white">Client login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
