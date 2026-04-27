const SEASON_STRENGTH = 1.5;
const HISTORY_STRENGTH = 0.3;

// Pure random derangement (Fisher-Yates shuffle with rejection sampling).
// Used as fallback and for cases with no history.
export function generateDerangement(members) {
  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = [...members];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    if (shuffled.every((v, i) => v !== members[i])) {
      const result = {};
      members.forEach((m, i) => { result[m] = shuffled[i]; });
      return result;
    }
  }
  throw new Error('Failed to generate derangement after max attempts');
}

function weightedPick(candidates) {
  const total = candidates.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) return c.id;
  }
  return candidates[candidates.length - 1].id;
}

function pairWeight(assignerId, assigneeId, seasonCounts, historyCounts) {
  const key = `${assignerId}→${assigneeId}`;
  const seasonTimes = seasonCounts[key] ?? 0;
  const totalTimes = historyCounts[key] ?? 0;
  return 1 / (1 + SEASON_STRENGTH * seasonTimes + HISTORY_STRENGTH * totalTimes);
}

export function generateWeightedDerangement(members, seasonCounts, historyCounts, maxAttempts = 500) {
  const hasHistory = Object.keys(seasonCounts).length > 0 || Object.keys(historyCounts).length > 0;
  if (!hasHistory) return generateDerangement(members);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = {};
    const assigned = new Set();

    const assignerOrder = [...members].sort(() => Math.random() - 0.5);

    let valid = true;
    for (const assigner of assignerOrder) {
      const candidates = members
        .filter(m => m !== assigner && !assigned.has(m))
        .map(assigneeId => ({
          id: assigneeId,
          weight: pairWeight(assigner, assigneeId, seasonCounts, historyCounts),
        }));

      if (candidates.length === 0) { valid = false; break; }

      const assignee = weightedPick(candidates);
      result[assigner] = assignee;
      assigned.add(assignee);
    }

    if (valid && Object.keys(result).length === members.length) return result;
  }

  console.warn('Weighted derangement failed after max attempts, falling back to pure random');
  return generateDerangement(members);
}