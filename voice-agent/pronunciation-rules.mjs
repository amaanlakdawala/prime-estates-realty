// ElevenLabs pronunciation-dictionary rules made from lib/place-names.js, for when the API key has the
// pronunciation_dictionaries_write permission: every place name said the Hindi way, whatever Riya writes.
import { HINDI_PLACE_NAMES as ALIASES } from '../lib/place-names.js';

// The dictionary matches exact text, so each entry is added as written, Capitalised and lowercase.
export function rules() {
  const out = new Map();
  for (const [word, alias] of Object.entries(ALIASES)) {
    for (const form of new Set([word, word[0].toUpperCase() + word.slice(1), word.toLowerCase()])) out.set(form, alias);
  }
  return [...out].map(([string_to_replace, alias]) => ({ type: 'alias', string_to_replace, alias }));
}
