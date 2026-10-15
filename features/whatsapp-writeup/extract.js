// Server only. Reads a messy property description (forwarded WhatsApp text, notes) and returns the
// facts as write-up fields. The AI only extracts; format.js does all the formatting.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

export const MAX_INPUT = 6000;

const Property = z.object({
  headline: z.string().describe('Short title, e.g. "3 BHK Flat for Sale", "Shop for Rent". "" if unclear.'),
  deal: z.string().describe('"Sale", "Rent" or "".'),
  location: z.string().describe('Building/project, area and city as written, e.g. "Lodha Park, Lower Parel, Mumbai".'),
  price: z.string().describe('Price as an Indian buyer reads it: "₹2.1 Cr", "₹85 L", "₹65,000/month". "" if not given.'),
  area: z.string().describe('Size with its unit and type if given, e.g. "1,050 sq ft carpet".'),
  floor: z.string(),
  furnishing: z.string().describe('"Fully furnished", "Semi-furnished", "Unfurnished" or "".'),
  parking: z.string(),
  facing: z.string(),
  possession: z.string().describe('e.g. "Ready to move", "Dec 2027".'),
  amenities: z.array(z.string()).describe('Short items, e.g. "Gym", "Swimming pool".'),
  highlights: z.array(z.string()).describe('Up to 5 short selling points stated in the text, e.g. "Sea view", "2 min from station".'),
  notes: z.string().describe('Anything else important in one or two short sentences, or "".'),
  rera: z.string().describe('MahaRERA / RERA number if given, else "".'),
});
const Result = z.object({ properties: z.array(Property) });

const INSTRUCTIONS = `You turn real estate brokers' property messages into clean, structured facts for a WhatsApp listing.

Rules:
- Extract only what the text states. Never add, guess or improve a fact, price, size or amenity. Leave a field "" (or an empty list) when the text doesn't say it.
- If the text describes several properties, return one entry per property, in the order they appear.
- Remove every phone number, email address, website link and the names of any broker or agent from all fields: the firm adds its own contact details.
- Fix spelling and capitalisation, expand obvious abbreviations (e.g. "SF" -> "Semi-furnished", "RTM" -> "Ready to move", "OC recd" -> "OC received"), and keep Indian units and money words (lakh, crore, sq ft).
- Write in English, even if the text mixes Hindi.`;

let client;
export async function extractProperties(text) {
  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'low', format: betaZodOutputFormat(Result) },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // if the main model declines, the request is retried on a fallback model
    system: INSTRUCTIONS,
    messages: [{ role: 'user', content: text.slice(0, MAX_INPUT) }],
  });
  if (response.stop_reason === 'refusal') throw new Error('This text could not be processed. Try removing anything that is not about the property.');
  const parsed = response.parsed_output;
  if (!parsed?.properties?.length) throw new Error('No property details were found in this text.');
  return parsed.properties;
}
