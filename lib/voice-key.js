import { sameSecret } from '@/lib/secret';

// True when a request comes from our AI voice agents: they send the x-voice-key header (VOICE_TOOL_SECRET).
export function fromVoiceAgent(request) {
  return sameSecret(request.headers.get('x-voice-key') ?? '', process.env.VOICE_TOOL_SECRET);
}
