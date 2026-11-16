export function regexCondition(source: string, pattern: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(source) ? `${source} =~ ${JSON.stringify(pattern)}` : "";
}
export function readRegexCondition(expression: string): {source: string; pattern: string} | undefined {
  const match = expression.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=~\s*("(?:[^"\\]|\\.)*")$/);
  if (!match) return;
  try { return {source: match[1], pattern: JSON.parse(match[2])}; } catch { return; }
}
