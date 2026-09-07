const vowels = /[aeiouy]+/gi;

export function estimateSyllables(line: string): { count: number; uncertain: boolean } {
  const words = line.toLowerCase().match(/[a-z']+/g) ?? [];
  let count = 0;
  let uncertain = false;
  for (const word of words) {
    const groups = word.match(vowels)?.length ?? 1;
    const silentE = word.endsWith("e") && groups > 1 ? 1 : 0;
    count += Math.max(1, groups - silentE);
    if (word.includes("'") || word.length > 9) uncertain = true;
  }
  return { count, uncertain: uncertain || words.length === 0 };
}

export function estimateHaiku(lines: string[]): { counts: number[]; uncertain: boolean } {
  const estimates = lines.map(estimateSyllables);
  const counts = estimates.map((item) => item.count);
  return { counts, uncertain: estimates.some((item) => item.uncertain) || counts.join("-") !== "5-7-5" };
}
