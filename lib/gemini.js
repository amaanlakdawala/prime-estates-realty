import { GoogleGenAI } from '@google/genai';

// Small one-shot Gemini calls (reading a lead email, writing out a voice note). Server only: GEMINI_API_KEY.
// The chatbot (lib/chat/assistant.js) and the owner search (lib/lead-owner.js) keep their own setup.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// Used when the main model is overloaded (HTTP 503 "high demand", or no answer within the timeout), which
// happens several times a day.
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash';
export const isOverloaded = (err) => [503, 504].includes(err?.status) || err?.name === 'AbortError'
  || /"code":\s*50[34]|UNAVAILABLE|DEADLINE_EXCEEDED|timed? ?out|aborted/i.test(err?.message ?? '');

let client;
const gemini = () => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set on the server.');
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 20000 } });
  return client;
};

// parts: text and/or { inlineData: { data: base64, mimeType } }. Returns the parsed JSON answer.
export async function geminiJson(parts, schema, model = GEMINI_MODEL) {
  let response;
  try {
    response = await gemini().models.generateContent({
      model,
      contents: [{ role: 'user', parts: parts.map((p) => (typeof p === 'string' ? { text: p } : p)) }],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        thinkingConfig: { thinkingLevel: 'low' },
        maxOutputTokens: 2000,
      },
    });
  } catch (err) {
    if (isOverloaded(err) && model !== GEMINI_FALLBACK_MODEL) return geminiJson(parts, schema, GEMINI_FALLBACK_MODEL);
    throw err;
  }
  return JSON.parse(response.text ?? 'null');
}
