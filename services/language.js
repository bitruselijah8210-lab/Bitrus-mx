// Lightweight heuristic detector. Hausa uses several distinctive words and
// the hooked letters ɓ ɗ ƙ. For production, swap in a proper language-ID
// library (e.g. `franc`) if you need higher accuracy on short messages.

const HAUSA_MARKERS = [
  "ina", "yaya", "lafiya", "nawa", "yaushe", "don", "wanne", "kudi",
  "sannu", "barka", "taimako", "abin", "zan", "kuma", "amma", "wannan",
];

export function detectLanguage(text) {
  const lower = text.toLowerCase();
  if (/[ɓɗƙ]/.test(lower)) return "ha";
  const hits = HAUSA_MARKERS.filter((w) => new RegExp(`\\b${w}\\b`).test(lower)).length;
  return hits >= 2 ? "ha" : "en";
}
