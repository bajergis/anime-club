/**
 * Generates a derangement (permutation with no fixed points) for a list of members.
 * Used each roll to assign who picks for whom — no one picks for themselves.
 */
export function generateDerangement(members) {
  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = [...members];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // Valid derangement: no position i where shuffled[i] === members[i]
    if (shuffled.every((v, i) => v !== members[i])) {
      const result = {};
      members.forEach((m, i) => { result[m] = shuffled[i]; });
      return result;
    }
  }
  throw new Error('Failed to generate derangement after max attempts');
}
