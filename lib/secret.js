import { timingSafeEqual } from 'node:crypto';

// True when a secret sent with a request matches the expected one (an environment variable).
// Compared in constant time; false when either is missing.
export function sameSecret(given, expected) {
  if (!expected || typeof given !== 'string' || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
