import { GoogleGenAI } from '@google/genai';
import { cleanName } from '@/lib/leads';

// Finds the person who runs a brokerage (owner, proprietor, founder or partner): Google Places never lists them,
// so Gemini searches the web (the firm's website, MahaRERA agent registrations, JustDial and similar listings).
// Server only (GEMINI_API_KEY; web search needs billing switched on for the key).
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const ROLES = ['Owner', 'Proprietor', 'Founder', 'Co-founder', 'Partner', 'Director', 'Managing Director', 'CEO'];

function prompt(lead) {
  return `Find the person who runs this real estate brokerage and makes its decisions: the owner, proprietor, founder, partner or director.

Business: ${cleanName(lead.name)}
Address: ${lead.address || lead.city || 'Mumbai'}
Website: ${lead.website || 'none'}
Phone: ${lead.phone || 'not listed'}

Search the web: the firm's own website, MahaRERA agent registrations, JustDial, IndiaMART, Google Business and LinkedIn pages that appear in search results.
Only name a person when a source clearly ties them to this business (same firm name, and the same area or phone number). A person from a different firm with a similar name is not an answer.

Answer with JSON only, no other text:
{"name": "full name", "role": "one of ${ROLES.join(', ')}", "confidence": "high or medium or low", "source": "where it was found, in a few words"}
or {"name": null} when nobody is clearly tied to this business.`;
}

// The owner of the lead, or null when the web does not clearly say. Throws when Gemini cannot be reached.
export async function findOwner(lead) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set on the server.');
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 20000 } });
  let response;
  try {
    response = await client.models.generateContent({
      model: MODEL,
      contents: prompt(lead),
      config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingLevel: 'low' }, maxOutputTokens: 2000 },
    });
  } catch (err) {
    if (err.status === 429) throw new Error('Gemini refused the web search (quota). Switch on billing for the Gemini key in Google AI Studio.');
    if (err.status === 503) throw new Error('Gemini is busy right now. Try again in a minute.');
    throw err;
  }
  const json = (response.text ?? '').match(/\{[\s\S]*\}/)?.[0];
  let answer;
  try {
    answer = JSON.parse(json ?? 'null');
  } catch {
    return null;
  }
  const name = String(answer?.name ?? '').trim();
  // A guess is worse than nothing: you would greet the wrong person.
  if (!name || name.length > 80 || !['high', 'medium'].includes(answer.confidence)) return null;
  const role = ROLES.find((r) => r.toLowerCase() === String(answer.role ?? '').trim().toLowerCase()) ?? 'Owner';
  const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []).map((c) => c.web?.title).filter(Boolean);
  const source = [String(answer.source ?? '').trim(), sources.length ? `(${[...new Set(sources)].slice(0, 3).join(', ')})` : '']
    .filter(Boolean).join(' ').slice(0, 300);
  return { name, role, source };
}
