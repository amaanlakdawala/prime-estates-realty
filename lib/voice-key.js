import { timingSafeEqual } from 'node:crypto';

// True when a request comes from our AI voice agents: they send the x-voice-key header (VOICE_TOOL_SECRET).
// Compared in constant time.
export function fromVoiceAgent(request) {
  const expected = process.env.VOICE_TOOL_SECRET;
  const given = request.headers.get('x-voice-key') ?? '';
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
