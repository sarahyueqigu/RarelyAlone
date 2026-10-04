// @ts-nocheck -- ported pipeline; keeps the validated scientific protocol unchanged.
import {type Json,type Database,canonical,norm,uid,sha,now} from './atlas-core';
export const BULK={
 'hp.obo':'https://github.com/obophenotype/human-phenotype-ontology/releases/latest/download/hp.obo',
 'phenotype.hpoa':'https://github.com/obophenotype/human-phenotype-ontology/releases/latest/download/phenotype.hpoa',
 'genes_to_disease.txt':'https://github.com/obophenotype/human-phenotype-ontology/releases/latest/download/genes_to_disease.txt',
 'mondo.obo':'https://github.com/monarch-initiative/mondo/releases/latest/download/mondo.obo',
 'NCBI2Reactome.txt':'https://reactome.org/download/current/NCBI2Reactome.txt'
};
export type IndexOptions={reactome?:boolean;excludeOmimDerived?:boolean;urls?:Partial<typeof BULK>;fetcher?:typeof fetch;chunkBytes?:number};
export type Bootstrap=Json&{version:string;phase:string;file:number;offset:number;carry:string;term:Json;header:string[];files:Json;mapping:Record<string,string>;after:string;rows:number;excluded:number};
const meta=(db:Database,id:string)=>db.call('get',{kind:'meta',id});
const save=(db:Database,s:Bootstrap)=>db.call('put',{kind:'meta',id:'bootstrap',value:s});
export function oboLine(term:Json,line:string){
 if(line.startsWith('id: '))term.id=line.slice(4);else if(line.startsWith('name: '))term.name=line.slice(6);
 else if(line.startsWith('is_a: '))(term.parents??=[]).push(line.slice(6).split(' ')[0]);
 else if(line==='is_obsolete: true')term.obsolete=true;
 else if(line.startsWith('xref: '))(term.xrefs??=[]).push(line.slice(6));
 else {const m=line.match(/^synonym: "(.*?)" EXACT/);if(m)(term.synonyms??=[]).push(m[1])}
}
const record=(kind:string,id:string,payload:Json)=>({kind,id,payload});
async function ingest(db:Database,ns:string,rows:Json[]){for(let i=0;i<rows.length;i+=700)await db.call('ingest',{ns,rows:rows.slice(i,i+700)})}
export async function consume(db:Database,s:Bootstrap,name:string,lines:string[],opts:IndexOptions,final=false){
 const rows:Json[]=[],features:Json[]=[],phenos:Json[]=[],diseases=new Map<string,Json>();
 const alias=(a:string,d:string)=>rows.push(record('alias',norm(a)+'|'+d,{id:norm(a)+'|'+d,alias:norm(a),disease:d}));
 const flush=()=>{const t=s.term;if(t.id&&!t.obsolete){t.parents??=[];t.synonyms??=[];t.xrefs??=[];rows.push(record(name==='hp.obo'?'term':'mondo',t.id,t))}s.term={}};
 for(const line0 of lines){const line=line0.replace(/\r$/,'');
  if(name.endsWith('.obo')){if(line.startsWith('['))flush();else oboLine(s.term,line);continue}
  if(!line)continue;
  const clean=line.replace(/^#+/,''),values=clean.split('\t');
  if(['database_id','ncbi_gene_id'].includes(values[0])){s.header=values;continue}if(line.startsWith('#'))continue;
  if(name==='NCBI2Reactome.txt'){const [gene,pathway,,label,,species]=line.split('\t');if(species==='Homo sapiens')rows.push(record('reactome',gene+'|'+pathway,{id:gene+'|'+pathway,gene,pathway,label}));continue}
  if(!s.header.length)throw Error('Unrecognized source header: '+name);
  const row=Object.fromEntries(s.header.map((h,i)=>[h,values[i]??''])),disease=canonical(row.database_id??row.disease_id);
  if(name==='phenotype.hpoa'){
   diseases.set(disease,{id:disease,name:row.disease_name,short:row.disease_name,plain:'',scope:'Exact database concept; subtypes are not silently merged.'});
   if(opts.excludeOmimDerived&&(row.evidence==='IEA'||row.reference.startsWith('OMIM:'))){s.excluded++;continue}
   const id=await uid(disease,row);rows.push(record('hpo',id,{id,disease,term:row.hpo_id,row}));s.rows++;
   if(row.aspect==='P'&&!absent(row))phenos.push({disease,term:row.hpo_id});
  }else{
   const gene=row.ncbi_gene_id.replace('NCBIGene:',''),id=await uid(disease,gene,row.source);rows.push(record('gene',id,{id,disease,gene,symbol:row.gene_symbol,source:row.source}));features.push({disease,dimension:'gene',feature:'NCBIGene:'+gene,value:1,origin:'index'});
  }
 }
 if(final&&name.endsWith('.obo'))flush();
 for(const d of diseases.values()){rows.push(record('disease',d.id,d));alias(d.id,d.id);alias(d.name,d.id)}
 const geneIds=[...new Set(rows.filter(r=>r.kind==='gene').map(r=>r.payload.disease))];
 const known=new Set<string>();for(let i=0;i<geneIds.length;i+=1000)for(const d of await db.call('rows',{ns:s.version,kind:'disease',ids:geneIds.slice(i,i+1000),limit:2000}))known.add(d.id);
 const dedup=[...new Map(rows.filter(r=>r.kind!=='gene'||known.has(r.payload.disease)).map(r=>[r.kind+'|'+r.id,r])).values()];await ingest(db,s.version,dedup);
 if(features.length)await db.call('features',{version:s.version,rows:[...new Map(features.filter(f=>known.has(f.disease)).map(f=>[f.disease+'|'+f.feature,f])).values()]});
 if(phenos.length)await db.call('hpo_features',{version:s.version,rows:phenos});
}
export const absent=(r:Json)=>r.qualifier==='NOT'||r.frequency==='HP:0040285'||/^0(?:\/\d+|%)$/.test(r.frequency??'');
class RangeUnsupported extends Error {constructor(public response:Response,public url:string){super('Source does not support byte ranges')}}
export async function rangeChunk(url:string,offset:number,size:number,etag?:string,fetcher:typeof fetch=fetch){
 let target=url,response:Response|undefined;
 for(let i=0;i<6;i++){
  const u=new URL(target);if(u.protocol!=='https:'||u.username||u.password||!['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com','raw.githubusercontent.com','reactome.org','download.reactome.org','reactome.org.uk','ftp.ebi.ac.uk','www.ebi.ac.uk'].includes(u.hostname))throw Error('Unapproved bulk-data host');
  response=await fetcher(target,{headers:{Range:`bytes=${offset}-${offset+size-1}`,'Accept-Encoding':'identity',...(etag?{'If-Match':etag}:{})},redirect:'manual',signal:AbortSignal.timeout(18000)});
  if(response.status>=300&&response.status<400){target=new URL(response.headers.get('location')!,target).href;continue}break;
 }
 const r=response!;if(!r.ok)throw Error(`Bulk source HTTP ${r.status}: ${new URL(url).hostname}`);
 const cr=r.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/),length=Number(r.headers.get('content-length'));
 if(r.status!==206&&!(offset===0&&length>0&&length<=size))throw new RangeUnsupported(r,target);
 if(cr&&Number(cr[1])!==offset)throw Error('Bulk source returned a wrong byte range');
 const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>size+4)throw Error('Bulk chunk exceeds size limit');
 const total=cr?Number(cr[3]):bytes.length,nextEtag=r.headers.get('etag')??undefined;
 if(etag&&nextEtag&&etag!==nextEtag)throw Error('Source changed mid-index; restart this index version');
 let usable=bytes.length;
 if(offset+bytes.length<total){let start=bytes.length-1;while(start>=0&&(bytes[start]&0xc0)===0x80)start--;const first=bytes[start],need=first>=0xf0?4:first>=0xe0?3:first>=0xc0?2:1;if(bytes.length-start<need)usable=start}
 if(!usable)throw Error('Empty source chunk');
 return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(0,usable)),next:offset+usable,total,etag:nextEtag,url:target,sha256:await sha(bytes.slice(0,usable)),bytes:usable,done:offset+usable>=total};
}
export async function bootstrapStep(db:Database,opts:IndexOptions={}):Promise<Json>{
 const ready=await meta(db,'index');if(ready)return {ready:true,snapshot:ready};
 const owner=crypto.randomUUID();if(!await db.call('lock',{key:'bootstrap',owner,seconds:120}))return {ready:false,busy:true};
 try{
  let s:Bootstrap=await meta(db,'bootstrap');
  if(!s)s={version:'index:'+crypto.randomUUID(),phase:'download',file:0,offset:0,carry:'',term:{},header:[],files:{},mapping:{},after:'',rows:0,excluded:0,startedAt:now()};
  const names=Object.keys(BULK).filter(n=>opts.reactome!==false||n!=='NCBI2Reactome.txt');
  if(s.phase==='download'){
   const name=names[s.file],prior=s.files[name]??{},url=(opts.urls??{})[name as keyof typeof BULK]??BULK[name as keyof typeof BULK];
   try{
    let chunk:Json;const size=opts.chunkBytes??262144;
    const local=await db.call('get',{ns:s.version,kind:'bulk',id:name});
    if(local){const bytes=new TextEncoder().encode(local.text);let end=Math.min(s.offset+size,bytes.length);while(end<bytes.length&&(bytes[end]&0xc0)===0x80)end--;const part=bytes.slice(s.offset,end);chunk={text:new TextDecoder().decode(part),next:s.offset+part.length,total:bytes.length,bytes:part.length,sha256:await sha(part),url,done:s.offset+part.length>=bytes.length,prefiltered:true,originalSha256:local.originalSha256}}
    else try{chunk=await rangeChunk(prior.pinnedUrl??url,s.offset,size,prior.etag,opts.fetcher)}catch(e){
     if(!(e instanceof RangeUnsupported)||name!=='NCBI2Reactome.txt'||s.offset!==0)throw e;
     const reader=e.response.body!.getReader(),parts:Uint8Array[]=[];let total=0;while(true){const r=await reader.read();if(r.done)break;total+=r.value.length;if(total>80000000){await reader.cancel();throw Error('Reactome download exceeds bounded fallback size')}parts.push(r.value)}
     const bytes=new Uint8Array(total);let pos=0;for(const part of parts){bytes.set(part,pos);pos+=part.length}
     const text=new TextDecoder().decode(bytes).split(/\r?\n/).filter(line=>line.split('\t')[5]==='Homo sapiens').join('\n')+'\n';if(text.length<100)throw Error('Reactome source did not contain human pathway mappings');
     await db.call('put',{ns:s.version,kind:'bulk',id:name,value:{text,originalSha256:await sha(bytes)}});await save(db,s);return {ready:false,phase:'download',file:name,note:'Human Reactome rows cached; bounded parsing resumes next request'};
    }
    const text=s.carry+chunk.text,lines=text.split('\n');s.carry=chunk.done?'':lines.pop()!;
    await consume(db,s,name,lines,opts,chunk.done);s.files[name]={url,pinnedUrl:chunk.url,etag:chunk.etag,totalBytes:chunk.total,prefiltered:chunk.prefiltered??false,originalSha256:chunk.originalSha256??null,retrievedAt:prior.retrievedAt??now(),loadedAt:now(),chunks:[...(prior.chunks??[]),{offset:s.offset,bytes:chunk.bytes,sha256:chunk.sha256}],status:chunk.done?'complete':'loading'};s.offset=chunk.next;
    if(chunk.done){s.file++;s.offset=0;s.carry='';s.term={};s.header=[];if(s.file>=names.length){s.phase='identity';s.after=''}}
   }catch(e){s.lastError=String(e);await save(db,s);throw e}
  }else if(s.phase==='identity'){
   const terms:Json[]=await db.call('rows',{ns:s.version,kind:'mondo',after:s.after,limit:200});
   const ids=[...new Set(terms.flatMap(t=>(t.xrefs??[]).filter((x:string)=>x.includes('MONDO:equivalentTo')).map((x:string)=>canonical(x.split(' ')[0]))))];
   const existing:Json[]=await db.call('rows',{ns:s.version,kind:'disease',ids,limit:2000}),known=new Set(existing.map(x=>x.id));
   const find=(d:string):string=>{s.mapping[d]??=d;while(s.mapping[d]!==d)d=s.mapping[d];return d};
   const rank=(d:string)=>(d.startsWith('OMIM:')?'0':d.startsWith('ORPHA:')?'1':'2')+d;
   for(const t of terms){const matches=(t.xrefs??[]).filter((x:string)=>x.includes('MONDO:equivalentTo')).map((x:string)=>canonical(x.split(' ')[0])).filter((d:string)=>known.has(d));for(const d of matches.slice(1)){const a=find(matches[0]),b=find(d);if(a!==b){const target=[a,b].sort((a,b)=>rank(a).localeCompare(rank(b)))[0];s.mapping[a]=target;s.mapping[b]=target}}}
   if(terms.length)s.after=terms.at(-1)!.id;else{for(const k of Object.keys(s.mapping))s.mapping[k]=find(k);s.phase='merge';s.after=''}
  }else if(s.phase==='merge'){
   const keys=Object.keys(s.mapping).filter(k=>k>s.after).sort().slice(0,100);if(keys.length){await db.call('canonicalize',{version:s.version,mapping:Object.fromEntries(keys.map(k=>[k,s.mapping[k]]))});s.after=keys.at(-1)!}else{s.phase='aliases';s.after=''}
  }else if(s.phase==='aliases'){
   const terms:Json[]=await db.call('rows',{ns:s.version,kind:'mondo',after:s.after,limit:200}),rows:Json[]=[];
   const ids=[...new Set(terms.flatMap(t=>(t.xrefs??[]).filter((x:string)=>x.includes('MONDO:equivalentTo')).map((x:string)=>canonical(x.split(' ')[0]))).map(id=>s.mapping[id]??id))],existing:Json[]=await db.call('rows',{ns:s.version,kind:'disease',ids,limit:2000}),known=new Set(existing.map(d=>d.id));
   for(const t of terms)for(const x of (t.xrefs??[]).filter((x:string)=>x.includes('MONDO:equivalentTo'))){const id=canonical(x.split(' ')[0]),disease=s.mapping[id]??id;if(!known.has(disease))continue;for(const a of [t.id,t.name,...(t.synonyms??[])]){const id=norm(a)+'|'+disease;rows.push(record('alias',id,{id,alias:norm(a),disease}))}}
   await ingest(db,s.version,[...new Map(rows.map(r=>[r.id,r])).values()]);if(terms.length)s.after=terms.at(-1)!.id;else{s.phase='pathways';s.after=''}
  }else if(s.phase==='pathways'){
   const ids:string[]=await db.call('pathway_features',{version:s.version,after:s.after});if(ids.length)s.after=ids.at(-1)!;else{s.phase='complete';const stats=await db.call('stats',{version:s.version}),snapshot={...stats,version:s.version,createdAt:now(),files:Object.fromEntries(Object.entries(s.files).map(([k,f]:[string,any])=>{const {pinnedUrl,...safe}=f;return [k,safe]})),excluded:s.excluded,reactome:opts.reactome!==false,phenotypePropagation:'ancestors only for candidate retrieval',hashFormat:'SHA-256 per ordered byte range; no whole-file digest claimed'};await db.call('put',{kind:'snapshot',id:s.version,value:snapshot});await db.call('put',{kind:'meta',id:'index',value:snapshot})}
  }
  delete s.lastError;await save(db,s);return {ready:s.phase==='complete',phase:s.phase,file:names[s.file]??null,bytes:s.offset,totalBytes:s.files[names[s.file]]?.totalBytes??null,annotations:s.rows};
 }finally{await db.call('unlock',{key:'bootstrap',owner})}
}
