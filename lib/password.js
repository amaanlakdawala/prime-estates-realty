// Random 12-character password without look-alike characters (0/O, 1/l/I), easy to read out or type.
export function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const values = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}
