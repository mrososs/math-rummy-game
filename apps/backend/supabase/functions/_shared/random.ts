// High-entropy, unpredictable seed for the server-side shuffle. The deck is
// never exposed to clients, and the seed is stored only in private.game_states.
export function randomSeed(prefix = 'srv'): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${hex}`;
}
