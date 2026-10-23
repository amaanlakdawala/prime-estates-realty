// Live health check of the deployed platform: every firm's pages, login and admin protection, the voice API
// and the database's enquiry protection. Reads only; writes nothing.
//   npm run smoke                      checks https://delightful-otter-34d9ac.netlify.app
//   npm run smoke -- https://other.site
// Reads .env.local (Supabase URL and public key; VOICE_TOOL_SECRET for the keyed checks) when it exists.
import { existsSync, readFileSync } from 'node:fs';

const env = { ...process.env };
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const site = (process.argv[2] || env.NEXT_PUBLIC_SITE_URL || 'https://delightful-otter-34d9ac.netlify.app').replace(/\/$/, '');

const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ ok: true, name, detail });
  } catch (err) {
    results.push({ ok: false, name, detail: err.message });
  }
};
const status = async (path, init) => (await fetch(`${site}${path}`, { redirect: 'manual', ...init })).status;
const expect = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: got ${got}, expected ${want}`);
  return `${what} ${got}`;
};

// Active firms with a website, read the way a visitor's browser would (public key, database rules apply).
let firms = [];
if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/firms?select=slug&active=eq.true&website_enabled=eq.true`, {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
  });
  firms = r.ok ? (await r.json()).map((f) => f.slug) : [];
}
if (!firms.length) firms = ['prime-estates'];

for (const slug of firms) {
  await check(`website /${slug}`, async () => {
    const html = await (await fetch(`${site}/${slug}`)).text();
    const pages = [...new Set([...html.matchAll(new RegExp(`href="(/${slug}[^"#?]*)"`, 'g'))].map((m) => m[1]))];
    const bad = [];
    for (const p of pages) { const s = await status(p); if (s !== 200) bad.push(`${p} ${s}`); }
    if (bad.length) throw new Error(bad.join(', '));
    return `${pages.length} pages, all 200`;
  });
}
await check('home page (your services)', async () => {
  const r = await fetch(`${site}/`, { redirect: 'manual' });
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  if (!(await r.text()).includes('Websites and AI calling for Mumbai property brokers')) throw new Error('services page not shown');
  return 'status 200';
});
await check('unknown firm is 404', async () => expect(await status('/no-such-firm-xyz'), 404, 'status'));
await check('login page', async () => expect(await status('/login'), 200, 'status'));
await check('admin needs login', async () => {
  const s = await status('/admin');
  if (![302, 303, 307, 308].includes(s)) throw new Error(`got ${s}, expected a redirect to /login`);
  return `redirect ${s}`;
});
await check('tower lookup refuses without key', async () => expect(await status('/api/voice/places?name=Powai'), 401, 'status'));
await check('call queue refuses without secret', async () => expect(await status('/api/voice/process-queue', { method: 'POST' }), 401, 'status'));
await check('Sarvam webhook refuses without key', async () => expect(await status('/api/voice/sarvam-webhook', { method: 'POST' }), 401, 'status'));
await check(`listings search (/${firms[0]})`, async () => {
  const r = await fetch(`${site}/api/voice/listings?firm=${firms[0]}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const body = await r.json();
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return `${(body.matches ?? []).length} matches`;
});
if (env.VOICE_TOOL_SECRET) {
  await check('tower lookup with key', async () => {
    const r = await fetch(`${site}/api/voice/places?name=Oberoi%20Splendor`, { headers: { 'x-voice-key': env.VOICE_TOOL_SECRET } });
    const body = await r.json();
    if (!r.ok || !body.found) throw new Error(`HTTP ${r.status}, found ${body.found}`);
    return `${body.project?.name ?? body.found} -> ${body.project?.area ?? ''}`;
  });
}
if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  // A firm id that cannot exist, so nothing is ever saved: a security refusal means the public cannot write enquiries.
  await check('database refuses direct enquiries', async () => {
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/enquiries`, {
      method: 'POST',
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ firm_id: '00000000-0000-0000-0000-000000000000', name: 'smoke check', phone: '0000000000' }),
    });
    const body = await r.json().catch(() => ({}));
    if (body.code !== '42501') throw new Error(`expected a security refusal, got ${r.status} ${body.code ?? ''}`);
    return 'refused by row-level security';
  });
}

console.log(`Health check of ${site}\n`);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.detail})`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
