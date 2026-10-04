// @ts-nocheck -- scientific source of truth, copied verbatim; written for looser TS settings than this project.
import {compare,pairs,edgeMap,edges,nodeMap,sourceMap,diseaseMap,strongestPaths,Edge} from './graph';
import {hypotheses,caveats,patientExplanation} from './hypotheses';
export type AtlasAnswer={answer:string;mode:'evidence'|'llm';notice:string;sourceIds:string[];edgeIds:string[];pairId:string;retrieved:number};
const aliases:Record<string,RegExp>={tay:/tay[–\s-]?sachs|hexa\b/i,sand:/sandhoff|hexb\b/i,npc:/niemann|\bnpc[12]?\b/i,gaucher:/gaucher|gba1?\b/i,spg:/spg11|spatacsin|spastic paraplegia/i};
export function retrieve(question:string,pairId:string){
 const selected=pairs.find(p=>p.id===pairId)??pairs[0],matched=Object.entries(aliases).filter(([,r])=>r.test(question)).map(([id])=>id);
 const pair=pairs.find(p=>matched.includes(p.a)&&matched.includes(p.b))??(matched.length===1?(pairs.find(p=>p.a===matched[0]||p.b===matched[0])??selected):selected);
 const c=compare(pair.a,pair.b),terms=question.toLowerCase().match(/[a-z0-9]{3,}/g)??[];
 const excluded=new Set('what why how the this that and are has ever been with would does disease diseases atlas connection connects near cluster similar similarity'.split(' '));
 const tokens=terms.filter(t=>!excluded.has(t));
 const pool=edges.filter(e=>[pair.a,pair.b,...matched].includes(e.disease)&&e.relationship!=='documented in');
 const ranked=pool.map(e=>{const text=[nodeMap[e.source].label,nodeMap[e.target].label,e.summary,e.evidenceType,e.context].join(' ').toLowerCase();return {e,rank:tokens.reduce((s,t)=>s+(text.includes(t)?1:0),0)}}).sort((a,b)=>b.rank-a.rank);
 const treatments=/treat|drug|miglustat|intervention|tested|therapy/i.test(question),experiment=/experiment|hypothes|test this|research approach/i.test(question);
 const required=treatments&&pair.id==='exploratory'?pool.filter(e=>e.target==='miglustat'||e.target==='trial-spg'):[];
 const pathEdges=strongestPaths(c).slice(0,3).flatMap(f=>[...f.pathA,...f.pathB]).map(id=>edgeMap[id]);
 const chosen=[...new Map([...required,...ranked.filter(r=>r.rank>0).slice(0,10).map(r=>r.e),...pathEdges].map(e=>[e.id,e])).values()].slice(0,22);
 const sourceIds=[...new Set(chosen.flatMap(e=>[...e.sourceIds,...e.contradictions.map(c=>c.sourceId)]))];
 return {pair,c,chosen,sourceIds,treatments,experiment,relevant:matched.length>0||ranked.some(r=>r.rank>0)||/connect|similar|cluster|experiment|hypothes|this/i.test(question)};
}
export function evidenceAnswer(question:string,pairId:string,audience:string='researcher'):AtlasAnswer{
 const r=retrieve(question,pairId);const {pair,c,chosen}=r;
 let answer='';let sourceIds=r.sourceIds;
 if(!r.relevant){answer='I could not find relevant evidence for that question in this five-disease snapshot. Ask about Tay–Sachs, Sandhoff, NPC, Gaucher or SPG11. Absence from this graph is not evidence that a connection does not exist.';sourceIds=[]}
 else if(r.experiment&&pair.id==='exploratory'){
  const h=hypotheses()[0];answer=`Proposed experiment — ${h.asset}\n\n${h.experiment}\n\nWhat would weaken the hypothesis: ${h.falsifier}\n\nThis is a proposed research experiment, not a clinical recommendation. [${h.sources.join(', ')}]`;sourceIds=h.sources;
 }else if(r.treatments&&pair.id==='exploratory'){
  answer='Yes. Miglustat, a drug used in NPC research and treatment contexts, has already been tested in SPG11. The registered phase II study was open-label, single-center and enrolled 10 participants. [S15, S18]\n\nThe published 12-week study reported little neuromotor impact and no significant change in plasma sphingolipid or ganglioside profiles. Safety was the primary outcome; this small uncontrolled study does not settle every possible treatment effect, but it does not establish benefit. [S10]\n\nLXR agonists and venglustat also have SPG11 preclinical evidence. Cell or mouse rescue is not demonstrated benefit for people. No direct SPG11 HPβCD rescue study was identified in this curated source set; that is not proof it has never been tested. [S09, S11, S14]';sourceIds=['S10','S15','S18','S09','S11','S14'];
 }else if(audience==='patient'){
  const p=patientExplanation(pair.id);answer=`${p.known}\n\n${p.uncertain}\n\n${p.meaning} [${p.sources.join(', ')}]`;sourceIds=p.sources;
 }else{
  const specific=/cholesterol|autophagy|assay|biomarker|calcium|model|gene|substrate|enzyme|variant|lipid/i.test(question);
  const selected=specific?chosen.slice(0,5):strongestPaths(c).slice(0,3).flatMap(f=>[edgeMap[f.pathA.at(-1)!],edgeMap[f.pathB.at(-1)!]]).filter(Boolean);
  answer=`${pair.label} has a calculated similarity index of ${c.overall.toFixed(1)}/100 in this snapshot. This is graph overlap, not a probability of shared treatment response.\n\n`+selected.map(e=>`${diseaseMap[e.disease].short}: ${e.summary} [${e.sourceIds.join(', ')}]`).join('\n\n');
  const caution=caveats[pair.id as keyof typeof caveats][pair.id==='exploratory'?1:0];answer+=`\n\nLimit: ${caution.text} [${caution.sources.join(', ')}]`;
  sourceIds=[...new Set([...selected.flatMap(e=>e.sourceIds),...caution.sources])];
 }
 return {answer,mode:'evidence',notice:'Graph evidence response · live language model is not connected.',sourceIds,edgeIds:chosen.map(e=>e.id),pairId:pair.id,retrieved:chosen.length};
}
export function modelContext(question:string,pairId:string){const r=retrieve(question,pairId);return {comparison:{pair:r.pair.label,index:r.c.overall,metrics:r.c.metrics.map(m=>({dimension:m.id,score:m.score}))},evidence:r.chosen.map(e=>({id:e.id,subject:nodeMap[e.source].label,relationship:e.relationship,object:nodeMap[e.target].label,summary:e.summary,context:e.context,type:e.evidenceType,direct:e.direct,confidence:e.confidence,sourceIds:e.sourceIds,contradictions:e.contradictions})),limitations:caveats[r.pair.id as keyof typeof caveats],hypotheses:r.pair.id==='exploratory'?hypotheses():[],sources:r.sourceIds.map(id=>sourceMap[id])}}
