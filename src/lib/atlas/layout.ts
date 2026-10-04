import { compare, diseases } from "./graph";

const MIN_GAP = 22;

export type Placed = { id: string; x: number; y: number };

/** All 10 pairwise overall similarities (0–100) from compare(). */
export function similarityMatrix(): { ids: string[]; sim: number[][] } {
  const ids = diseases.map((d) => d.id);
  const sim = ids.map(() => ids.map(() => 100));
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const s = compare(ids[i]!, ids[j]!).overall;
      sim[i]![j] = s;
      sim[j]![i] = s;
    }
  return { ids, sim };
}

/** Classical MDS on distance = 100 − similarity + a constant floor (monotone, keeps ranking; stops near-identical pairs overlapping). */
export function proximityLayout(): { nodes: Placed[]; sim: number[][]; ids: string[] } {
  const { ids, sim } = similarityMatrix();
  const n = ids.length;
  const d2 = sim.map((row, i) => row.map((s, j) => (i === j ? 0 : 100 - s + MIN_GAP) ** 2));
  const rowMean = d2.map((r) => r.reduce((a, b) => a + b, 0) / n);
  const all = rowMean.reduce((a, b) => a + b, 0) / n;
  let B = d2.map((r, i) => r.map((v, j) => -0.5 * (v - rowMean[i]! - rowMean[j]! + all)));

  const coords: number[][] = [];
  for (let k = 0; k < 2; k++) {
    let v = ids.map((_, i) => 1 + i * 0.37);
    let lambda = 0;
    for (let it = 0; it < 500; it++) {
      const w = B.map((r) => r.reduce((s, x, j) => s + x * v[j]!, 0));
      const norm = Math.hypot(...w) || 1;
      lambda = w.reduce((s, x, i) => s + x * v[i]!, 0);
      v = w.map((x) => x / norm);
    }
    const scale = Math.sqrt(Math.max(lambda, 0));
    coords.push(v.map((x) => x * scale));
    B = B.map((r, i) => r.map((x, j) => x - lambda * v[i]! * v[j]!));
  }
  // Fix orientation deterministically (MDS is rotation/sign invariant): first disease to the left/top.
  if (coords[0]![0]! > 0) coords[0] = coords[0]!.map((x) => -x);
  if (coords[1]![0]! > 0) coords[1] = coords[1]!.map((x) => -x);
  // Refine with stress majorization (SMACOF, weights 1/d²) so every pairwise distance — incl. close pairs — is honoured.
  const D = d2.map((r) => r.map(Math.sqrt));
  let X = ids.map((_, i) => [coords[0]![i]!, coords[1]![i]!]);
  for (let it = 0; it < 300; it++) {
    X = X.map((xi, i) => {
      let wx = 0, wy = 0, ws = 0;
      X.forEach((xj, j) => {
        if (i === j) return;
        const w = 1 / D[i]![j]! ** 2, dist = Math.hypot(xi[0]! - xj[0]!, xi[1]! - xj[1]!) || 1e-6;
        wx += w * (xj[0]! + (D[i]![j]! * (xi[0]! - xj[0]!)) / dist);
        wy += w * (xj[1]! + (D[i]![j]! * (xi[1]! - xj[1]!)) / dist);
        ws += w;
      });
      return [wx / ws, wy / ws];
    });
  }
  return { ids, sim, nodes: ids.map((id, i) => ({ id, x: X[i]![0]!, y: X[i]![1]! })) };
}
