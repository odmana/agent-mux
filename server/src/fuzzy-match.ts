export interface FuzzyResult {
  text: string;
  score: number;
  matchIndices: number[];
}

function isWordBoundary(candidate: string, index: number): boolean {
  if (index === 0) return true;
  const prev = candidate[index - 1];
  if (prev === '-' || prev === '_' || prev === '.' || prev === ' ') return true;
  // camelCase boundary: lowercase followed by uppercase
  if (
    prev === prev.toLowerCase() &&
    prev !== prev.toUpperCase() &&
    candidate[index] === candidate[index].toUpperCase() &&
    candidate[index] !== candidate[index].toLowerCase()
  ) {
    return true;
  }
  return false;
}

export function fuzzyMatch(pattern: string, candidate: string): FuzzyResult | null {
  if (pattern.length === 0) {
    return { text: candidate, score: 0, matchIndices: [] };
  }

  const pLower = pattern.toLowerCase();
  const cLower = candidate.toLowerCase();

  // Greedy left-to-right match to find indices (also rejects non-matches)
  const matchIndices: number[] = [];
  let ci = 0;
  for (let pi = 0; pi < pLower.length; pi++) {
    const found = cLower.indexOf(pLower[pi], ci);
    if (found === -1) return null;
    matchIndices.push(found);
    ci = found + 1;
  }

  // Score the match
  let score = 0;
  for (let i = 0; i < matchIndices.length; i++) {
    const idx = matchIndices[i];

    // Base score per match
    score += 1;

    // Prefix bonus
    if (idx === 0) score += 5;

    // Word boundary bonus
    if (isWordBoundary(candidate, idx)) score += 3;

    // Consecutive bonus
    if (i > 0 && matchIndices[i] === matchIndices[i - 1] + 1) {
      score += 4;
    }

    // Gap penalty
    if (i > 0) {
      const gap = matchIndices[i] - matchIndices[i - 1] - 1;
      score -= gap;
    }
  }

  return { text: candidate, score, matchIndices };
}

export function fuzzySort(pattern: string, candidates: string[]): FuzzyResult[] {
  const results: FuzzyResult[] = [];
  for (const c of candidates) {
    const result = fuzzyMatch(pattern, c);
    if (result) results.push(result);
  }
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.text.localeCompare(b.text);
  });
  return results;
}
