// @ts-nocheck -- scientific source of truth, copied verbatim; written for looser TS settings than this project.
import rawNodes from '@/data/nodes.json';
import rawSources from '@/data/sources.json';
import tay from '@/data/diseases/tay.json';
import sand from '@/data/diseases/sand.json';
import npc from '@/data/diseases/npc.json';
import gaucher from '@/data/diseases/gaucher.json';
import spg from '@/data/diseases/spg.json';
export type Dimension='mechanism'|'pathway'|'phenotype'|'molecular'|'assets';
export type Node={id:string;label:string;type:string;dimension:Dimension|null;description:string;external:string|null};
export type Source=typeof rawSources[number];
export type Edge={id:string;disease:string;source:string;target:string;relationship:string;sourceIds:string[];summary:string;direct:boolean;evidenceType:string;confidence:number;context:string;contradictions:{sourceId:string;summary:string}[];scoreEligible:boolean;polarity:string};
export type Disease={id:string;name:string;short:string;plain:string;scope:string;edges:Edge[];nodeIds:string[]};
export const nodes=rawNodes as Node[], sources=rawSources as Source[], diseases=[tay,sand,npc,gaucher,spg] as Disease[];
export const nodeMap=Object.fromEntries(nodes.map(n=>[n.id,n])),sourceMap=Object.fromEntries(sources.map(s=>[s.id,s])),diseaseMap=Object.fromEntries(diseases.map(d=>[d.id,d]));
export const edges=diseases.flatMap(d=>d.edges),edgeMap=Object.fromEntries(edges.map(e=>[e.id,e]));
export const dimensions:{id:Dimension;label:string;short:string}[]=[{id:'mechanism',label:'Mechanism overlap',short:'Mechanism'},{id:'pathway',label:'Pathway overlap',short:'Pathway'},{id:'phenotype',label:'Phenotype overlap',short:'Phenotype'},{id:'molecular',label:'Molecular / substrate',short:'Molecular'},{id:'assets',label:'Research-asset overlap',short:'Assets'}];
export const snapshot={version:'1.0.0',reviewed:'3 October 2026',method:'Confidence-weighted Jaccard · equal dimensions · IDF across 5 diseases'};
export type Options={models:boolean;inferred:boolean};
export const defaultOptions:Options={models:true,inferred:false};
export const isModel=(e:Edge)=>/experiment|rescue|model/i.test(e.evidenceType);
export function evidenceWeight(e:Edge){return e.confidence*(e.direct?1:.6)*(e.contradictions.length?.85:1)}
export type Feature={id:string;value:number;path:string[]};
export function profile(d:Disease,options:Options=defaultOptions):Record<string,Feature>{
 const found:Record<string,Feature>={[d.id]:{id:d.id,value:1,path:[]}};
 const eligible=d.edges.filter(e=>e.scoreEligible&&e.polarity==='support'&&(options.models||!isModel(e))&&(options.inferred||e.direct));
 // Disease-local traversal prevents a shared node from importing another disease's evidence.
 for(let pass=0;pass<12;pass++){
  let changed=false;
  for(const e of eligible){const from=found[e.source];if(!from)continue;const value=Math.min(from.value,evidenceWeight(e)),path=[...from.path,e.id],prior=found[e.target];
   if(!prior||value>prior.value+1e-9||(Math.abs(value-prior.value)<1e-9&&path.length<prior.path.length)){found[e.target]={id:e.target,value,path};changed=true}}
  if(!changed)break;
 }
 return Object.fromEntries(Object.entries(found).filter(([id])=>nodeMap[id].dimension));
}
export type Contribution={id:string;a:number;b:number;idf:number;numerator:number;denominator:number;pathA:string[];pathB:string[]};
export type Metric={id:Dimension;score:number|null;numerator:number;denominator:number;features:Contribution[]};
export function compare(a:string,b:string,options:Options=defaultOptions){
 const profiles=Object.fromEntries(diseases.map(d=>[d.id,profile(d,options)])),pa=profiles[a],pb=profiles[b];
 if(!pa||!pb)throw new Error('Unknown disease');
 const featureIds=[...new Set([...Object.keys(pa),...Object.keys(pb)])];
 const features=featureIds.map(id=>{const av=pa[id]?.value||0,bv=pb[id]?.value||0,df=diseases.filter(d=>profiles[d.id][id]).length,idf=1+Math.log((1+diseases.length)/(1+df));return {id,a:av,b:bv,idf,numerator:Math.min(av,bv)*idf,denominator:Math.max(av,bv)*idf,pathA:pa[id]?.path||[],pathB:pb[id]?.path||[]}});
 const metrics:Metric[]=dimensions.map(({id})=>{const fs=features.filter(f=>nodeMap[f.id].dimension===id),numerator=fs.reduce((s,f)=>s+f.numerator,0),denominator=fs.reduce((s,f)=>s+f.denominator,0);return {id,score:denominator?100*numerator/denominator:null,numerator,denominator,features:fs}});
 const shared=features.filter(f=>f.a>0&&f.b>0).sort((a,b)=>b.numerator-a.numerator||a.id.localeCompare(b.id));
 const mech=shared.filter(f=>nodeMap[f.id].dimension==='mechanism');
 const denominator=shared.reduce((s,f)=>s+f.idf,0),confidence=denominator?100*shared.reduce((s,f)=>s+Math.min(f.a,f.b)*f.idf,0)/denominator:0;
 const available=metrics.filter(m=>m.score!==null);
 return {a,b,metrics,overall:available.reduce((s,m)=>s+m.score!,0)/(available.length||1),shared,features,strongest:mech[0]??shared[0],confidence,coverage:available.length};
}
export type Comparison=ReturnType<typeof compare>;
// Validation roles are display metadata only; compare() never imports or consults this table.
export const pairs=[{id:'gm2',a:'tay',b:'sand',label:'Tay–Sachs ↔ Sandhoff',role:'Positive control',detail:'High-confidence mechanistic control'},{id:'lysosomal',a:'npc',b:'gaucher',label:'NPC ↔ Gaucher',role:'Positive control',detail:'Broader biological control'},{id:'exploratory',a:'spg',b:'npc',label:'SPG11 ↔ NPC',role:'Exploratory',detail:'Exploratory research connection'}];
export function strongestPaths(c:Comparison){return [...c.shared].sort((a,b)=>Number(nodeMap[b.id].dimension==='mechanism')-Number(nodeMap[a.id].dimension==='mechanism')||b.numerator-a.numerator).slice(0,8)}
export function pairEdges(c:Comparison){return [...diseaseMap[c.a].edges,...diseaseMap[c.b].edges]}
export function evidenceSources(es:Edge[]){return [...new Set(es.flatMap(e=>[...e.sourceIds,...e.contradictions.map(c=>c.sourceId)]))].map(id=>sourceMap[id])}
