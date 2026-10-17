// Listing reels: a 1080x1920 vertical video drawn frame by frame on a canvas from the listing's photos.
// Browser only (needs Image and canvas). The same drawReelFrame() draws the live preview and the MP4.
import { formatPrice, typeLabel } from './format';

export const REEL = { width: 1080, height: 1920, fps: 30 };
export const SPEEDS = { fast: 2.2, normal: 3, slow: 4 }; // seconds per photo
export const MAX_REEL_PHOTOS = 12;
export const TAGS = ['Just listed', 'For rent', 'Price drop', 'New launch', 'Open house', 'Sold', 'Rented'];

const W = REEL.width, H = REEL.height;
const FADE = 0.6;          // cross-fade between photos
const INTRO_EXTRA = 1;     // the first photo stays a second longer, to read the headline
const OUTRO = 3.5;         // closing card with the phone number
// Instagram covers the top ~200px and bottom ~380px with its own buttons and caption, and the right edge with icons.
const SAFE = { top: 110, bottom: H - 400, left: 60, right: W - 160 };
// The site's palette (tailwind.config.js): royal blue, deep navy, and a light blue accent.
const C = { brand: '#2B59E8', brandDark: '#1F45C2', accent: '#8AB4FF', ink: '#0B1324', white: '#FFFFFF' };
const DISPLAY = '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif';
const SANS = 'Inter, "Segoe UI", system-ui, sans-serif';

export function defaultTag(listing) {
  if (listing.status === 'sold') return 'Sold';
  if (listing.status === 'rented') return 'Rented';
  return listing.deal_type === 'rent' ? 'For rent' : 'Just listed';
}

export function placeLine(listing, site) {
  return [listing.locality, site.city].filter((v, i, a) => v && a.indexOf(v) === i).join(', ');
}

// One fact per photo after the first: "3 BHK · 1,250 sq ft", amenities, floor.
export function reelFacts(listing) {
  const facts = [];
  const specs = [listing.bhk ? `${listing.bhk} BHK` : '', listing.area_sqft ? `${Number(listing.area_sqft).toLocaleString('en-IN')} sq ft` : ''].filter(Boolean).join(' · ');
  facts.push({ label: typeLabel(listing.property_type), value: specs || typeLabel(listing.property_type) });
  const amenities = (listing.amenities ?? []).slice(0, 3);
  if (amenities.length) facts.push({ label: 'Amenities', value: amenities.join(' · ') });
  if (listing.floor) facts.push({ label: 'Floor', value: listing.floor });
  if ((listing.amenities ?? []).length > 3) facts.push({ label: 'Also has', value: listing.amenities.slice(3, 6).join(' · ') });
  return facts;
}

// Bigger versions of Unsplash photos (the demo listings use them); uploaded photos are already full size.
export function hiResUrl(url) {
  return /images\.unsplash\.com/.test(url) ? url.replace(/([?&])w=\d+/, '$1w=2000') : url;
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // without this the canvas can't be turned into a video
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

// A soft, blurred copy of a photo for the background of the "Framed" style (shrink, then stretch back up).
export function makeBackdrop(img) {
  const steps = [[27, 48], [108, 192]];
  let src = img;
  for (const [w, h] of steps) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    if (src === img) drawCover(ctx, img, 0, 0, w, h, 1, 0.5, 0.5);
    else ctx.drawImage(src, 0, 0, w, h);
    src = c;
  }
  return src;
}

// Everything drawReelFrame needs, worked out once. photos: [{ img, backdrop }].
export function buildPlan({ listing, site, photos, logo, tag, headline, showPrice, style, speed, siteUrl }) {
  const per = SPEEDS[speed] ?? SPEEDS.normal;
  const scenes = [];
  let at = 0;
  photos.forEach((p, i) => {
    const length = per + (i === 0 ? INTRO_EXTRA : 0) + (photos.length === 1 ? 1.5 : 0);
    scenes.push({ ...p, start: at, length });
    at += length;
  });
  const facts = reelFacts(listing);
  return {
    scenes,
    outroStart: at,
    duration: at + OUTRO,
    style,
    logo,
    tag,
    headline: headline.trim() || listing.title,
    place: placeLine(listing, site),
    price: showPrice ? formatPrice(listing.price, listing.deal_type) : '',
    rera: listing.rera_number ? `MahaRERA: ${listing.rera_number}` : '',
    facts: scenes.slice(1).map((_, i) => facts[i] ?? null),
    firmName: site.name,
    phone: site.phoneDisplay,
    agentRera: site.mahareraAgentNo ? `MahaRERA Agent: ${site.mahareraAgentNo}` : '',
    website: siteUrl.replace(/^https?:\/\//, ''),
    summary: [listing.bhk ? `${listing.bhk} BHK` : typeLabel(listing.property_type), listing.locality, showPrice ? formatPrice(listing.price, listing.deal_type) : ''].filter(Boolean).join(' · '),
  };
}

// ---------- drawing ----------

const clamp = (v) => Math.min(1, Math.max(0, v));
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

// Fade/slide in after `start + delay`, fade out just before `end`.
function appear(t, start, end, delay = 0) {
  const inP = easeOut(clamp((t - start - delay) / 0.45));
  return { alpha: Math.min(inP, clamp((end - t) / 0.35)), shift: (1 - inP) * 40 };
}

// Fill a box with the image (cropping the overflow), zoomed by `zoom`, panned to (px, py) in 0..1.
function drawCover(ctx, img, x, y, w, h, zoom, px, py) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x - (dw - w) * px, y - (dh - h) * py, dw, dh);
}

// Slow zoom and pan (Ken Burns); alternate scenes move the other way.
function drawMoving(ctx, img, x, y, w, h, p, i) {
  const e = easeInOut(p);
  const zoom = 1.04 + 0.1 * (i % 2 ? 1 - e : e);
  const px = 0.5 + (i % 2 ? -1 : 1) * (e - 0.5) * 0.7;
  drawCover(ctx, img, x, y, w, h, zoom, px, 0.5);
}

function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function text(ctx, str, x, y, { font, color = C.white, align = 'left', shadow = true, spacing = 0 }) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.shadowColor = shadow ? 'rgba(0,0,0,0.55)' : 'transparent';
  ctx.shadowBlur = shadow ? 14 : 0;
  ctx.shadowOffsetY = shadow ? 2 : 0;
  ctx.fillText(str, x, y);
  ctx.shadowColor = 'transparent';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function drawPhoto(ctx, plan, scene, i, t) {
  const p = clamp((t - scene.start) / (scene.length + FADE));
  if (plan.style === 'framed') {
    ctx.drawImage(scene.backdrop, 0, 0, W, H);
    ctx.fillStyle = 'rgba(15, 25, 28, 0.35)';
    ctx.fillRect(0, 0, W, H);
    const fw = W - 120;
    const fh = Math.min(Math.round(fw * Math.max(scene.img.height / scene.img.width, 0.75)), 900);
    const fx = 60, fy = Math.round(740 - fh / 2); // above the text at the bottom
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, 36); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, 36); ctx.clip();
    drawMoving(ctx, scene.img, fx, fy, fw, fh, p * 0.6, i);
    ctx.restore();
  } else {
    drawMoving(ctx, scene.img, 0, 0, W, H, p, i);
  }
}

function drawShades(ctx) {
  let g = ctx.createLinearGradient(0, 0, 0, 420);
  g.addColorStop(0, 'rgba(10,18,20,0.6)');
  g.addColorStop(1, 'rgba(10,18,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 420);
  g = ctx.createLinearGradient(0, H - 1100, 0, H);
  g.addColorStop(0, 'rgba(10,18,20,0)');
  g.addColorStop(0.55, 'rgba(10,18,20,0.6)');
  g.addColorStop(1, 'rgba(10,18,20,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 1100, W, 1100);
}

function drawHeader(ctx, plan) {
  if (plan.logo) {
    const h = 96, w = Math.min(plan.logo.width * (h / plan.logo.height), 380);
    ctx.drawImage(plan.logo, SAFE.left, SAFE.top, w, (w / plan.logo.width) * plan.logo.height);
  } else {
    ctx.font = `700 42px ${DISPLAY}`;
    const name = wrap(ctx, plan.firmName, 560, 1)[0];
    text(ctx, name, SAFE.left, SAFE.top + 50, { font: `700 42px ${DISPLAY}` });
  }
  if (plan.tag) {
    ctx.font = `700 32px ${SANS}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    const label = plan.tag.toUpperCase();
    const w = ctx.measureText(label).width + 56;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const x = W - SAFE.left - w;
    ctx.fillStyle = C.accent;
    ctx.beginPath(); ctx.roundRect(x, SAFE.top, w, 68, 34); ctx.fill();
    text(ctx, label, x + w / 2, SAFE.top + 46, { font: `700 32px ${SANS}`, color: C.ink, align: 'center', shadow: false, spacing: 3 });
  }
}

// First photo: headline, place, price (and the project's MahaRERA number, which ads must show).
function drawIntro(ctx, plan, t, end) {
  const maxW = SAFE.right - SAFE.left;
  ctx.font = `700 88px ${DISPLAY}`;
  const lines = wrap(ctx, plan.headline, maxW, 3);
  const block = [];
  if (plan.price) block.push({ h: 120, draw: (y) => text(ctx, plan.price, SAFE.left, y, { font: `700 104px ${DISPLAY}`, color: C.accent }) });
  if (plan.place) block.push({ h: 70, draw: (y) => {
    ctx.fillStyle = C.accent;
    ctx.fillRect(SAFE.left, y - 34, 10, 40);
    text(ctx, plan.place, SAFE.left + 30, y, { font: `600 46px ${SANS}` });
  } });
  [...lines].reverse().forEach((line) => block.push({ h: 98, draw: (y) => text(ctx, line, SAFE.left, y, { font: `700 88px ${DISPLAY}` }) }));
  if (plan.rera) text(ctx, plan.rera, SAFE.left, SAFE.bottom + 70, { font: `500 30px ${SANS}`, color: 'rgba(255,255,255,0.85)' });

  // Laid out from the bottom up, revealed from the top down.
  let y = SAFE.bottom - 20;
  const placed = block.map((b) => { const at = y; y -= b.h; return { ...b, at }; }).reverse();
  placed.forEach((b, k) => {
    const a = appear(t, 0.2, end, k * 0.15);
    ctx.globalAlpha = a.alpha;
    b.draw(b.at + a.shift);
    ctx.globalAlpha = 1;
  });
}

// Later photos: one fact on a white card.
function drawFact(ctx, fact, t, start, end) {
  const a = appear(t, start + 0.15, end);
  if (a.alpha <= 0) return;
  const maxW = SAFE.right - SAFE.left - 80;
  ctx.font = `700 66px ${DISPLAY}`;
  const lines = wrap(ctx, fact.value, maxW, 2);
  const h = 90 + lines.length * 78;
  const w = Math.min(SAFE.right - SAFE.left, Math.max(...lines.map((l) => ctx.measureText(l).width), 300) + 80);
  const x = SAFE.left - a.shift * 1.5, y = SAFE.bottom - h;
  ctx.globalAlpha = a.alpha;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  ctx.fillStyle = C.white;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 28); ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.accent;
  ctx.fillRect(x, y + 28, 10, h - 56);
  text(ctx, fact.label.toUpperCase(), x + 40, y + 62, { font: `700 30px ${SANS}`, color: C.brand, shadow: false, spacing: 2 });
  lines.forEach((l, k) => text(ctx, l, x + 40, y + 140 + k * 78, { font: `700 66px ${DISPLAY}`, color: C.ink, shadow: false }));
  ctx.globalAlpha = 1;
}

// Closing card: how to get in touch.
function drawOutro(ctx, plan, t) {
  const p = clamp((t - plan.outroStart) / FADE);
  if (p <= 0) return;
  ctx.globalAlpha = p;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.brand);
  g.addColorStop(1, C.brandDark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, maxW = W - 160;
  let y = 740; // centres the block vertically
  const items = [];
  if (plan.logo) {
    items.push((yy) => {
      const h = 150, w = Math.min(plan.logo.width * (h / plan.logo.height), 600);
      const hh = (w / plan.logo.width) * plan.logo.height;
      ctx.drawImage(plan.logo, cx - w / 2, yy - hh, w, hh);
    });
  } else {
    items.push((yy) => {
      ctx.font = `700 76px ${DISPLAY}`;
      wrap(ctx, plan.firmName, maxW, 2).forEach((l, k, all) => text(ctx, l, cx, yy - (all.length - 1 - k) * 86, { font: `700 76px ${DISPLAY}`, align: 'center', shadow: false }));
    });
  }
  const rows = [
    () => items[0],
    () => (yy) => text(ctx, plan.summary, cx, yy, { font: `500 40px ${SANS}`, color: 'rgba(255,255,255,0.85)', align: 'center', shadow: false }),
    () => (yy) => text(ctx, 'Interested? Call or WhatsApp', cx, yy, { font: `700 50px ${DISPLAY}`, color: C.white, align: 'center', shadow: false }),
    () => plan.phone && ((yy) => text(ctx, plan.phone, cx, yy, { font: `700 104px ${DISPLAY}`, align: 'center', shadow: false })),
    () => plan.website && ((yy) => {
      ctx.font = `500 38px ${SANS}`;
      text(ctx, wrap(ctx, plan.website, maxW, 1)[0], cx, yy, { font: `500 38px ${SANS}`, color: 'rgba(255,255,255,0.9)', align: 'center', shadow: false });
    }),
    () => plan.agentRera && ((yy) => text(ctx, plan.agentRera, cx, yy, { font: `500 30px ${SANS}`, color: 'rgba(255,255,255,0.75)', align: 'center', shadow: false })),
  ];
  const gaps = [0, 110, 150, 140, 110, 90];
  rows.forEach((row, k) => {
    const draw = row();
    y += gaps[k];
    if (!draw) return;
    const a = appear(t, plan.outroStart + 0.2, Infinity, k * 0.12);
    ctx.globalAlpha = p * a.alpha;
    draw(y + a.shift);
  });
  ctx.globalAlpha = 1;
}

export function drawReelFrame(ctx, t, plan) {
  ctx.save();
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, W, H);
  plan.scenes.forEach((scene, i) => {
    if (t < scene.start || t > scene.start + scene.length + FADE) return;
    ctx.globalAlpha = i === 0 ? 1 : easeInOut(clamp((t - scene.start) / FADE));
    drawPhoto(ctx, plan, scene, i, t);
  });
  ctx.globalAlpha = 1;
  if (t < plan.outroStart + FADE) {
    drawShades(ctx);
    drawHeader(ctx, plan);
    const first = plan.scenes[0];
    if (first) drawIntro(ctx, plan, t, first.start + first.length);
    plan.scenes.slice(1).forEach((scene, k) => {
      const fact = plan.facts[k];
      if (fact && t >= scene.start && t <= scene.start + scene.length) drawFact(ctx, fact, t, scene.start, scene.start + scene.length);
    });
  }
  drawOutro(ctx, plan, t);
  ctx.restore();
}

// ---------- caption ----------

export function reelCaption({ listing, site, plan, listingUrl }) {
  const specs = [listing.bhk ? `${listing.bhk} BHK` : '', listing.area_sqft ? `${Number(listing.area_sqft).toLocaleString('en-IN')} sq ft` : '', typeLabel(listing.property_type)].filter(Boolean).join(' · ');
  const tagged = plan.tag ? `${plan.tag}: ${plan.headline}` : plan.headline;
  const amenities = (listing.amenities ?? []).slice(0, 4).join(' · ');
  const tagWord = (s) => s.replace(/[^A-Za-z0-9]/g, '');
  const city = tagWord(site.city || '');
  const hashtags = [
    city && `#${city}RealEstate`,
    listing.locality && `#${tagWord(listing.locality)}`,
    listing.bhk && `#${listing.bhk}BHK`,
    `#${tagWord(typeLabel(listing.property_type).split('/')[0])}For${listing.deal_type === 'rent' ? 'Rent' : 'Sale'}`,
    city && `#${city}Property`,
  ].filter(Boolean).slice(0, 5);
  const line = (show, str) => (show ? str : null);
  return [
    `✨ ${tagged}`,
    '',
    line(plan.place, `📍 ${plan.place}`),
    `🏠 ${specs}`,
    line(plan.price, `💰 ${plan.price}`),
    line(amenities, `✅ ${amenities}`),
    '',
    line(site.phoneDisplay, `📞 Call or WhatsApp ${site.name}: ${site.phoneDisplay}`),
    line(listingUrl, `🔗 Photos and details: ${listingUrl}`),
    line(listing.rera_number, `MahaRERA: ${listing.rera_number}`),
    line(site.mahareraAgentNo, `MahaRERA Agent: ${site.mahareraAgentNo}`),
    '',
    hashtags.join(' '),
  ].filter((l) => l !== null).join('\n');
}
