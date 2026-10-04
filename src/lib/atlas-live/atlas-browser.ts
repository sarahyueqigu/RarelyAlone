import type { Json } from "./atlas-core";
let worker: Worker | undefined;
let counter = 0;
const pending = new Map<number, { resolve: (v: Json) => void; reject: (e: Error) => void }>();
function instance() {
  if (!worker) {
    worker = new Worker(new URL("./atlas-worker.ts", import.meta.url), { type: "module", name: "rarelyalone-atlas" });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id); pending.delete(data.id);
      if (data.error) p?.reject(Error(data.error)); else p?.resolve(data.value);
    };
    worker.onerror = () => {
      for (const p of pending.values()) p.reject(Error("Atlas worker could not start. Check browser storage and reload."));
      pending.clear(); worker?.terminate(); worker = undefined;
    };
  }
  return worker;
}
export function atlasCall(action: string, args: Json = {}): Promise<Json> {
  return new Promise((resolve, reject) => { const w = instance(), id = ++counter; pending.set(id, { resolve, reject }); w.postMessage({ id, action, args }); });
}
export async function askAtlas(input: Json, signal?: AbortSignal) {
  const r = await fetch("/api/atlas-live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ask", input: JSON.stringify(input) }), ...(signal ? { signal } : {}) });
  const j = await r.json(); if (!r.ok) throw Error(j.error || "Atlas answer unavailable"); return j.value as { answer: string; uncertainty: string; sourceIds: string[] };
}
export const LAST_JOB = "rarelyalone-atlas-last-job";
export const pause = (ms = 150) => new Promise<void>(r => setTimeout(r, ms));
