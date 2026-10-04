// @ts-nocheck -- ported pipeline; keeps the validated scientific protocol unchanged.
export type Json=Record<string,any>;
export type Dimension='mechanism'|'pathway'|'phenotype'|'molecular'|'assets';
export type Node={id:string;label:string;type:string;dimension:Dimension|null;description?:string;external?:string|null};
export type Edge={id:string;disease:string;source:string;target:string;relationship:string;sourceIds:string[];summary:string;direct:boolean;evidenceType:string;confidence:number;context:string;contradictions:{sourceId:string;summary:string}[];scoreEligible:boolean;polarity:string;[key:string]:any};
export type Disease={id:string;name:string;short?:string;plain?:string;scope?:string;aliases?:string[];[key:string]:any};
export type Profile={disease:Disease;nodes:Node[];sources:Json[];edges:Edge[];documents:Json[];coverage:Json[];genes:Json[];fingerprint?:string;updatedAt?:string;complete?:boolean};
export type Feature={id:string;dimension:Dimension;value:number;path:string[]};
export const DIMENSIONS:Dimension[]=['mechanism','pathway','phenotype','molecular','assets'];
export const now=()=>new Date().toISOString();
export const norm=(x:unknown)=>String(x??'').normalize('NFKD').replace(/[^\x00-\x7F]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const canonical=(id:string)=>id.replace(/^MIM:/,'OMIM:').replace(/^Orphanet:/,'ORPHA:');
export const stable=(x:any):string=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export async function sha(x:string|Uint8Array){const b=typeof x==='string'?new TextEncoder().encode(x):x;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b as BufferSource))].map(v=>v.toString(16).padStart(2,'0')).join('')}
export async function uid(...x:any[]){return (await sha(stable(x))).slice(0,20)}
export const byId=<T extends {id:string}>(rows:T[])=>new Map(rows.map(r=>[r.id,r]));
export function blank(disease:Disease):Profile{return {disease,nodes:[{id:disease.id,label:disease.name,type:'disease',dimension:null}],sources:[],edges:[],documents:[],coverage:[],genes:[]}}
export function upsert<T extends Json>(rows:T[],row:T){const i=rows.findIndex(x=>x.id===row.id);if(i<0)rows.push(row);else rows[i]=row;return row.id}
export function node(p:Profile,id:string,label:string,type:string,dimension:Dimension|null=null,extra:Json={}){return upsert(p.nodes,{id,label,type,dimension,description:'',external:null,...extra})}
export function source(p:Profile,id:string,title:string,url:string,type:string,extra:Json={}){return upsert(p.sources,{id,title,url,type,accessed:now().slice(0,10),year:'',note:'',...extra})}
export async function edge(p:Profile,from:string,to:string,relationship:string,sourceIds:string[],summary:string,extra:Partial<Edge>={}){
 const context=extra.context??'unspecified',polarity=extra.polarity??'support';
 const id='E:'+await uid(p.disease.id,from,to,relationship,[...sourceIds].sort(),context,polarity,extra.quote??'');
 upsert(p.edges,{id,disease:p.disease.id,source:from,target:to,relationship,sourceIds,summary,direct:true,evidenceType:'curated annotation',confidence:.8,context,contradictions:[],scoreEligible:false,polarity,reviewStatus:'automated',extractedAt:now(),...extra});return id;
}
export function coverage(p:Profile,source:string,status:string,extra:Json={}){const row={source,status,checkedAt:now(),...extra},i=p.coverage.findIndex(x=>x.source===source);if(i<0)p.coverage.push(row);else p.coverage[i]=row}
export function profileFeatures(p:Profile,includeModels=true,includeInferred=false):Feature[]{
 const es=p.edges.filter(e=>e.disease===p.disease.id&&e.scoreEligible&&e.polarity==='support'&&(e.direct||includeInferred)&&(includeModels||(e.modelSystem??'unspecified')==='human')).sort((a,b)=>a.id.localeCompare(b.id));
 const found=new Map<string,{value:number;path:string[]}>([[p.disease.id,{value:1,path:[]}]]);
 for(let pass=0;pass<16;pass++){let changed=false;
  for(const e of es){const parent=found.get(e.source);if(!parent||parent.path.includes(e.id))continue;
   const value=Math.min(parent.value,e.confidence*(e.direct?1:.6)*(e.contradictions.length?.85:1)),old=found.get(e.target),path=[...parent.path,e.id];
   if(!old||value>old.value+1e-9||(Math.abs(value-old.value)<1e-9&&path.length<old.path.length)){found.set(e.target,{value,path});changed=true}
  }if(!changed)break;
 }
 const nodes=byId(p.nodes);return [...found].filter(([id])=>DIMENSIONS.includes(nodes.get(id)?.dimension as Dimension)).map(([id,v])=>({id,dimension:nodes.get(id)!.dimension!,...v}));
}
export function compare(a:Profile,b:Profile,n:number,df:Record<string,number>):Json{
 const pa=byId(profileFeatures(a)),pb=byId(profileFeatures(b));
 const features=[...new Set([...pa.keys(),...pb.keys()])].sort().map(id=>{const dimension=(pa.get(id)??pb.get(id))!.dimension,av=pa.get(id)?.value??0,bv=pb.get(id)?.value??0,idf=1+Math.log((n+1)/((df[dimension+'|'+id]??0)+1));return {id,dimension,a:av,b:bv,idf,numerator:Math.min(av,bv)*idf,denominator:Math.max(av,bv)*idf,pathA:pa.get(id)?.path??[],pathB:pb.get(id)?.path??[]}});
 const metrics=DIMENSIONS.map(id=>{const fs=features.filter(f=>f.dimension===id),denominator=fs.reduce((s,f)=>s+f.denominator,0),numerator=fs.reduce((s,f)=>s+f.numerator,0),observedA=fs.some(f=>f.a>0),observedB=fs.some(f=>f.b>0);return {id,score:denominator&&observedA&&observedB?100*numerator/denominator:null,numerator,denominator,observedA,observedB,shared:fs.filter(f=>f.a>0&&f.b>0).length}});
 const shared=features.filter(f=>f.a&&f.b).sort((x,y)=>Number(y.dimension==='mechanism')-Number(x.dimension==='mechanism')||y.numerator-x.numerator),available=metrics.filter(m=>m.score!==null);
 const negatives=[...a.edges,...b.edges].filter(e=>['negative','contradict'].includes(e.polarity)||e.contradictions.length);
 return {a:a.disease.id,b:b.disease.id,overall:available.length?available.reduce((s,m)=>s+m.score!,0)/available.length:null,metrics,coverage:available.length,confidence:shared.length?100*shared.reduce((s,f)=>s+f.numerator,0)/shared.reduce((s,f)=>s+f.idf,0):null,shared,features,strongest:shared[0]?.id??null,paths:shared.slice(0,8),counterevidence:negatives.map(e=>e.id),association:shared.some(f=>f.dimension!=='assets'),relationshipType:'Exploratory evidence overlap',interpretation:'Graph overlap; not clinical equivalence, significance, or treatment efficacy.',limitations:['Missing dimensions remain unknown.','Confidence is a heuristic curation weight, not a calibrated probability.','Model and human findings require context-specific review.']};
}
export function reconcile(p:Profile){for(const e of p.edges){if(e.polarity!=='support')continue;for(const n of p.edges.filter(n=>['negative','contradict'].includes(n.polarity)&&n.target===e.target&&n.source===e.source)){const summary=n.summary+' Context: '+n.context+' (possible qualification; contexts may differ)';for(const sourceId of n.sourceIds)if(!e.contradictions.some(x=>x.sourceId===sourceId&&x.summary===summary))e.contradictions.push({sourceId,summary})}}}
export function hypotheses(a:Profile,b:Profile,c:Json){
 if(!c.association)return [];
 const edges=byId([...a.edges,...b.edges]),nodes=byId([...a.nodes,...b.nodes]),assets=[...edges.values()].filter(e=>['treatment/intervention','experimental model','research asset'].includes(nodes.get(e.target)?.type??'')),out:Json[]=[];
 for(const f of c.shared.filter((f:Json)=>['mechanism','molecular','pathway'].includes(f.dimension)).slice(0,2)){
  const support=[...f.pathA,...f.pathB].map(id=>edges.get(id)!),feature=nodes.get(f.id)!.label;
  for(const asset of assets.slice(0,3)){const target=nodes.get(asset.target)!.label,tested=[...edges.values()].filter(e=>e.disease!==asset.disease&&e.target===asset.target),evidence=[...support,asset,...tested];
   out.push({candidate:target,status:'Exploratory research proposal; not a clinical recommendation',feature:f.id,rationale:`Both profiles have evidence paths to ${feature}; ${target} appears in one profile as a study intervention, model or asset.`,existingEvidence:[asset,...tested].map(e=>({summary:e.summary,sourceIds:e.sourceIds,context:e.context,polarity:e.polarity})),missingEvidence:'Transferability, exposure, genotype-specific response and causal rescue need testing. Absence from this bounded search does not mean never tested.',proposedExperiment:`Use patient-derived cells and isogenic corrected controls for each disease, with at least three independent differentiations. First quantify ${feature} at baseline. Then evaluate whether ${target} is an applicable assay/model or perturbation; if applicable, compare it with vehicle/control and a genetic rescue. Predefine a mechanism-specific primary endpoint, blinded analysis, viability/toxicity and a downstream functional endpoint. Estimate variance in a pilot before powering the confirmatory experiment.`,falsifier:'No reproducible shared baseline defect, or molecular change without functional rescue, weakens the proposed transfer.',sourceIds:[...new Set(evidence.flatMap(e=>e.sourceIds))].sort(),evidenceEdges:evidence.map(e=>e.id)});
  }
 }return out.slice(0,4);
}
export function project(comparisons:Json[],ids:string[]){
 const n=ids.length,pts=ids.map((_,i)=>[Math.cos(2*Math.PI*i/Math.max(n,1)),Math.sin(2*Math.PI*i/Math.max(n,1))]),known=comparisons.filter(c=>c.overall!==null).map(c=>[ids.indexOf(c.a),ids.indexOf(c.b),.12+1-c.overall/100]);
 for(let step=0;step<450;step++){const grads=pts.map(()=>[0,0]);for(const [i,j,target] of known){const dx=pts[i][0]-pts[j][0],dy=pts[i][1]-pts[j][1],dist=Math.max(Math.hypot(dx,dy),1e-6),g=(dist-target)/dist;grads[i][0]+=g*dx;grads[j][0]-=g*dx;grads[i][1]+=g*dy;grads[j][1]-=g*dy}for(let i=0;i<n;i++)for(let ax=0;ax<2;ax++)pts[i][ax]-=.12/Math.max(n,1)*grads[i][ax]}
 const error=known.reduce((s,[i,j,t])=>s+(Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1])-t)**2,0),den=known.reduce((s,[,,t])=>s+t*t,0);
 return {method:'deterministic metric stress layout',normalizedStress:den?Math.sqrt(error/den):null,note:'2D proximity approximates similarity; inspect the exact score. Missing comparisons do not imply distance.',nodes:ids.map((id,i)=>({id,x:pts[i][0],y:pts[i][1]}))};
}
export function bundle(profiles:Profile[],n:number,df:Record<string,number>,snapshot:Json){
 const comparisons:Json[]=[];for(let i=0;i<profiles.length;i++)for(let j=i+1;j<profiles.length;j++){const c=compare(profiles[i],profiles[j],n,df);c.hypotheses=hypotheses(profiles[i],profiles[j],c);comparisons.push(c)}
 const edges=profiles.flatMap(p=>p.edges).map(e=>{const {quote,diseaseQuote,...safe}=e;return safe}),ids=profiles.map(p=>p.disease.id),nodeIds=new Set([...ids,...edges.flatMap(e=>[e.source,e.target])]),sourceIds=new Set(edges.flatMap(e=>[...e.sourceIds,...e.contradictions.map(c=>c.sourceId)]));
 return {schemaVersion:'atlas-pipeline/0.1',generatedAt:now(),diseases:profiles.map(p=>({...p.disease,edges:edges.filter(e=>e.disease===p.disease.id),nodeIds:[p.disease.id,...new Set(p.edges.flatMap(e=>[e.source,e.target]))],coverage:p.coverage})),nodes:[...byId(profiles.flatMap(p=>p.nodes)).values()].filter(x=>nodeIds.has(x.id)),sources:[...byId(profiles.flatMap(p=>p.sources as (Json&{id:string})[])).values()].filter(s=>sourceIds.has(s.id)),edges,comparisons,network:project(comparisons,ids),indexSnapshot:snapshot,method:{similarity:'confidence-weighted, IDF-weighted Jaccard over disease-local evidence paths; equal mean of observed dimensions',dimensions:DIMENSIONS,retrieval:'sparse inverted index over HPO ancestors, genes, Reactome and cached evidence; reciprocal rank fusion; bounded literature-name recall expansion',limitations:['Automated extraction is unreviewed; source spans validate provenance, not entailment.','Names, trial listings, funding and web mentions are not mechanism scores.','The projection can distort distances.','Missing evidence and correlated features can bias scores.']}};
}
export interface Database {call<T=any>(op:string,args?:Json):Promise<T>}
export function postgrest(url:string,serviceKey:string):Database{
 if(!url.startsWith('https://')||!serviceKey)throw Error('Configure the existing server-side database connection');
 return {async call(op,args={}){const r=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/atlas_rpc',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({op,p:args}),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`Atlas database operation ${op} failed (${r.status}): ${(await r.text()).slice(0,350)}`);return r.json()}};
}
