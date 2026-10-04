// @ts-nocheck -- isolated browser worker using the same SQL and scientific modules as the server port.
import { PGlite } from "@electric-sql/pglite";
import { OpfsAhpFS } from "@electric-sql/pglite/opfs-ahp";
import { createAtlas } from "./atlas-backend";
import migration from "./atlas.sql?raw";

const endpoint = "/api/atlas-live";
async function api(body: any, signal?: AbortSignal) {
  const r = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const j = await r.json();
  if (!r.ok) throw Error(j.error || `Atlas server returned ${r.status}`);
  return j;
}
const proxyFetch: typeof fetch = async (url, init = {}) => {
  const headers = new Headers(init.headers);
  const r = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "source", url: String(url), range: headers.get("range"), etag: headers.get("if-match"), ...(init.body ? { body: init.body } : {}) }), signal: init.signal });
  if (r.headers.get("X-Atlas-Redirect")) { const j = await r.json(); return new Response(null, { status: j.status, headers: { location: j.redirect } }); }
  return r;
};

let instance: Promise<ReturnType<typeof createAtlas>> | undefined;
let activeJob = "";
async function open() {
  const config = await api({ action: "config" });
  let releaseLock: () => void = () => {};
  let pg: PGlite | undefined;
  // One writer per browser prevents two tabs from corrupting the local PostgreSQL files.
  if (!navigator.locks) throw Error("Live Atlas requires a browser with Web Locks (current Chrome, Edge, Firefox or Safari).");
  await new Promise<void>((resolve, reject) => {
    navigator.locks.request("rarelyalone-atlas-database", { ifAvailable: true }, async lock => {
      if (!lock) { reject(Error("Atlas is open in another tab. Close that tab and retry here.")); return; }
      const held = new Promise<void>(release => { releaseLock = release; });
      resolve(); await held;
    }).catch(reject);
  });
  try {
  const useOpfs = !!navigator.storage?.getDirectory;
  pg = useOpfs ? await PGlite.create({ fs: new OpfsAhpFS("rarelyalone-atlas-v1") }) : await PGlite.create("idb://rarelyalone-atlas-v1");
  await pg.exec(migration);
  const db = { async call(op: string, args = {}) { const r = await pg.query("select atlas_rpc($1,$2::jsonb) as value", [op, JSON.stringify(args)]); return r.rows[0].value; } };
  const model = config.enabled ? {
    id: config.model, inputPerMillion: config.inputPerMillion, outputPerMillion: config.outputPerMillion,
    complete: async (q: any) => api({ action: "extract", input: q.input, jobId: activeJob }, q.signal),
  } : undefined;
  return createAtlas({ db, model, fetcher: proxyFetch, modelTimeoutMs: 50000, secrets: config.omim ? { omimKey: "server-configured" } : {}, orgSeeds: config.orgSeeds });
  } catch (error) { await pg?.close().catch(() => {}); releaseLock(); throw error; }
}
// Serialize worker commands as well as the underlying database connection.
let queue = Promise.resolve();
self.onmessage = ({ data: { id, action, args = {} } }) => {
  queue = queue.then(async () => {
    try {
      const atlas = await (instance ??= open().catch(error => { instance = undefined; throw error; }));
      const owner = "this-browser";
      let value;
      if (action === "status") value = await atlas.status();
      else if (action === "bootstrap") value = await atlas.bootstrap();
      else if (action === "search") value = await atlas.search(args.query);
      else if (action === "query") value = await atlas.query(owner, args.disease, args.top_k ?? 3, args.requestId);
      else if (action === "job") value = await atlas.job(owner, args.jobId);
      else if (action === "advance") { activeJob = args.jobId; value = await atlas.advance(owner, args.jobId); }
      else throw Error("Unknown worker action");
      self.postMessage({ id, value });
    } catch (e) { self.postMessage({ id, error: e instanceof Error ? e.message : String(e) }); }
  });
};
