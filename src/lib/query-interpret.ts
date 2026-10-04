// Deterministic natural-language query extraction for Resources + Ask Rarely Alone.
// Strips question framing only; keeps disease, gene, symptom, study and treatment words.

const FRAMING = [
  /^(?:can you |could you |please )?tell me (?:more )?about\s+/i,
  /^(?:i want |i need |i'd like )?(?:more )?info(?:rmation)? (?:about|on|for)\s+/i,
  /^(?:are|is) there (?:any )?(?:studies|study|trials|trial|research) (?:for|on|about|involving|in)\s+/i,
  /^find (?:me )?(?:studies|trials|research) (?:for|on|about|involving)\s+/i,
  /^(?:what|why|how) (?:is|are|does|do|did|causes?)\s+(?:an?\s+|the\s+)?/i,
  /^explain\s+/i,
];
const TRAILING = /\s+(?:do|does|mean|means|cause|causes|work|works)$/i;

export function extractQuery(input: string): string {
  let q = input.replace(/[?!.]+/g, " ").replace(/\s+/g, " ").trim();
  for (let changed = true; changed; ) {
    changed = false;
    for (const re of FRAMING) {
      const next = q.replace(re, "");
      if (next !== q && next.trim()) { q = next.trim(); changed = true; }
    }
  }
  return q.replace(TRAILING, "").trim();
}
