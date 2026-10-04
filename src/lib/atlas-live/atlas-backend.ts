// @ts-nocheck -- ported pipeline; keeps the validated scientific protocol unchanged.
import {type Json,type Database,type Profile,type Disease,blank,norm,uid,now,profileFeatures,reconcile,bundle} from './atlas-core';
import {type IndexOptions,bootstrapStep} from './atlas-index';
import {Http,Yield,type Secrets,type Limits,type Model,DEFAULTS,annotations,orphanet,omim,clinvar,trials,literature,reporter,organizations,extract,openTargets,cellosaurus,reactomeHierarchy} from './atlas-sources';
export type AtlasConfig={db:Database;model?:Model;secrets?:Secrets;limits?:Partial<Limits>;index?:IndexOptions;orgSeeds?:Json[];orgRecords?:Json[];fetcher?:typeof fetch;owner?:(request:Request)=>Promise<string|null>;allowedOrigins?:string[];jobsPerDay?:number;globalJobsPerDay?:number;modelTimeoutMs?:number};
const stages=['HPO','Open Targets','Cellosaurus','Reactome','Orphanet','OMIM','ClinVar','ClinicalTrials.gov','PubMed/PMC','NIH RePORTER','Patient organizations'];
const get=(db:Database,kind:string,id:string,ns='global')=>db.call('get',{ns,kind,id});
const put=(db:Database,kind:string,id:string,value:any,ns='global',expires?:string)=>db.call('put',{ns,kind,id,value,expires});
export function createAtlas(config:AtlasConfig){
 const db=config.db,limits={...DEFAULTS,...config.limits},secrets=config.secrets??{};
 const index=()=>get(db,'meta','index');
 const profileKey=(v:string,id:string,fp:string)=>v+'|'+id+'|'+fp;
 async function fingerprint(snapshot:Json){return uid('profile-ts-3',snapshot.version,config.orgSeeds??[],config.orgRecords??[],!!secrets.omimKey,limits.papers,limits.claimsPerDisease,limits.fulltext,config.model?.id??'structured-only')}
 async function status(){const snapshot=await index(),setup=snapshot?null:await get(db,'meta','bootstrap');return {indexReady:!!snapshot,index:snapshot?{version:snapshot.version,diseases:snapshot.diseases,createdAt:snapshot.createdAt}:null,setup:setup?{phase:setup.phase,file:setup.file,bytes:setup.offset,lastError:setup.lastError}:null,llmEnabled:!!config.model,model:config.model?.id??null,maxUSDPerQuery:limits.maxUSD,globalUSDPerDay:limits.globalUSD,maxJobsPerDay:config.jobsPerDay??10}}
 async function search(query:string){if(query.length<2||query.length>180)throw Error('Enter 2–180 characters');const snapshot=await index();if(!snapshot)return {matches:[],indexReady:false};return {matches:await db.call('search',{version:snapshot.version,query:norm(query)}),indexReady:true}}
 async function resolve(id:string,snapshot:Json){const equivalent=await get(db,'equivalent',id,snapshot.version);return get(db,'disease',equivalent?.canonical??id,snapshot.version)}
 async function query(owner:string,disease:string,top_k=3,requestId:string=crypto.randomUUID()){
  if(!Number.isInteger(top_k)||top_k<1||top_k>5||!/^[-a-f0-9]{36}$/i.test(requestId)||disease.length>180)throw Error('Expected an exact disease ID, top_k 1–5 and UUID requestId');
  const snapshot=await index();if(!snapshot)throw Error('Index setup is still running');const d: Disease=await resolve(disease,snapshot);if(!d)throw Error('Select an exact disease ID from autocomplete');
  const id=crypto.randomUUID().replace(/-/g,''),state={version:snapshot.version,fingerprint:await fingerprint(snapshot),ids:[d.id],diseaseIndex:0,stage:0,document:0,selected:false,phase:'enrich',draft:null,failures:[],admitted:0,rejected:[],httpCacheHits:0,llmCacheHits:0,audit:[],candidates:[]};
  return db.call('enqueue',{owner,disease:d.id,top_k,requestId,id,state:{...state,top_k},perDay:config.jobsPerDay??10,globalPerDay:config.globalJobsPerDay??100});
 }
 async function job(owner:string,id:string,internal=false){const j=await db.call('job',{owner,id});if(!j)return null;if(internal)return j;return {jobId:id,status:j.status,error:j.error,result:j.result??undefined,createdAt:j.createdAt,updatedAt:j.updatedAt,progress:{phase:j.state.phase,disease:j.state.ids[j.state.diseaseIndex]??null,completedDiseases:j.state.diseaseIndex,totalDiseases:j.state.ids.length,source:stages[j.state.stage]??'Mechanistic extraction',documentsProcessed:j.state.document}}}
 async function advance(owner:string,id:string){
  let j=await job(owner,id,true);if(!j)throw Error('Unknown job');if(['complete','error'].includes(j.status))return job(owner,id);
  const token=crypto.randomUUID();if(!await db.call('lock',{key:'research',owner:token,seconds:120}))return job(owner,id);
  let h:Http|undefined;
  try{
   j=await job(owner,id,true);if(['complete','error'].includes(j.status))return job(owner,id);const s=j.state,snapshot:Json=await get(db,'snapshot',s.version)??await index();
   if(snapshot.version!==s.version)throw Error('Index version changed; start a new research job');
   const did=s.ids[s.diseaseIndex];
   if(s.phase==='enrich'){
    if(!s.draft){const cached:Profile=await get(db,'profile',profileKey(s.version,did,s.fingerprint),'profiles');
     if(cached?.complete){s.profiles??={};s.profiles[did]=cached;s.diseaseIndex++;s.stage=0;s.document=0;s.phase=s.selected?(s.diseaseIndex>=s.ids.length?'compare':'enrich'):'select'}
     else{s.draft=blank(await resolve(did,snapshot));s.failures=[];s.admitted=0;s.stage=0;s.document=0}
    }
    if(s.draft){const p:Profile=s.draft;h=new Http(db,id,{...limits,maxRequests:limits.maxRequests*(1+(s.top_k??3))},config.fetcher,[...(config.orgSeeds??[]).map(r=>new URL(r.url).hostname)]);
     const actions=[()=>annotations(p,db,snapshot),()=>openTargets(p,h!),()=>cellosaurus(p,h!),()=>reactomeHierarchy(p,h!),()=>orphanet(p,h!),()=>omim(p,h!,secrets),()=>clinvar(p,h!,secrets),()=>trials(p,h!),()=>literature(p,h!,secrets,limits.papers,limits.fulltext),()=>reporter(p,h!),()=>organizations(p,h!,config.orgSeeds,config.orgRecords)];
     if(s.stage<actions.length){try{await actions[s.stage]();s.stage++}catch(e){if(e instanceof Yield)throw e;const name=stages[s.stage];p.coverage=p.coverage.filter(c=>c.source!==name);p.coverage.push({source:name,status:/budget/i.test(String(e))?'budget_exhausted':'unavailable',reason:String(e).slice(0,500),checkedAt:now()});s.stage++}}
     else if(s.document<Math.min(p.documents.length,limits.claimsPerDisease)){
      try{const r=await extract(p,p.documents[s.document],db,id,config.model,limits,config.modelTimeoutMs??40000);s.admitted+=r.admitted;s.rejected.push(...r.rejected);s.llmCacheHits+=Number(r.cached)}catch(e){s.failures.push(String(e))}s.document++;
     }else{
      p.coverage=p.coverage.filter(c=>c.source!=='Mechanistic extraction');p.coverage.push({source:'Mechanistic extraction',status:s.failures.length?'partial':config.model?'automated_unreviewed':'disabled',claims:s.admitted,failures:s.failures,documentsAttempted:Math.min(p.documents.length,limits.claimsPerDisease),reason:config.model?null:'Structured-only mode does not turn literature mentions into mechanistic claims.',checkedAt:now()});reconcile(p);
      const fs=profileFeatures(p);await db.call('features',{version:s.version,disease:did,origin:'evidence',replace:true,rows:fs.map(f=>({disease:did,dimension:f.dimension,feature:f.id,value:f.value,origin:'evidence'}))});
      p.fingerprint=s.fingerprint;p.updatedAt=now();p.complete=!p.coverage.some(c=>['unavailable','partial','budget_exhausted'].includes(c.status));
      await put(db,'profile',profileKey(s.version,did,s.fingerprint),p,'profiles',new Date(Date.now()+7*86400000).toISOString());
      const aliases=(p.disease.aliases??[]).map(a=>({kind:'alias',id:norm(a)+'|'+did,payload:{id:norm(a)+'|'+did,alias:norm(a),disease:did}}));if(aliases.length)await db.call('ingest',{ns:s.version,rows:aliases});
      s.profiles??={};s.profiles[did]=p;s.draft=null;s.diseaseIndex++;s.stage=0;s.document=0;s.phase=s.selected?(s.diseaseIndex>=s.ids.length?'compare':'enrich'):'select';
     }
     if(p.nodes.length)await db.call('ingest',{ns:'graph',rows:p.nodes.map(n=>({kind:'node',id:n.id,payload:n}))});
    }
   }else if(s.phase==='select'){
    const root=s.ids[0],candidates:Json[]=await db.call('shortlist',{version:s.version,disease:root,limit:40}),lead:Json[]=await db.call('literature_candidates',{version:s.version,disease:root,text:norm(s.profiles[root].documents.map((d:Json)=>d.text).join(' ')),exclude:candidates.map(c=>c.id)});candidates.push(...lead);
    const selected=candidates.slice(0,s.top_k);if(lead[0]&&selected.length&&!selected.includes(lead[0]))selected[selected.length-1]=lead[0];s.candidates=candidates;s.ids=[root,...selected.map(c=>c.id)];s.selected=true;s.phase=s.diseaseIndex>=s.ids.length?'compare':'enrich';
   }else if(s.phase==='compare'){
    const profiles:Profile[]=s.ids.map((did:string)=>s.profiles[did]),features=[...new Set(profiles.flatMap(p=>profileFeatures(p).map(f=>f.id)))],df=await db.call('df',{version:s.version,ids:features}),result:Json=bundle(profiles,snapshot.diseases,df,snapshot);result.query=s.ids[0];result.candidates=s.candidates;result.candidateCount=s.candidates.length;result.enrichedCount=profiles.length;result.coverageWarning='Neighbor recall is bounded by this index, retrieval channels and top-k limit. Unselected diseases were not adjudicated.';result.cost={...await db.call('cost',{job:id}),httpCacheHits:s.httpCacheHits,llmCacheHits:s.llmCacheHits,maxUSD:limits.maxUSD,rejectedClaims:s.rejected,pricing:'User-supplied rates; unknown-charge attempts retain reservations.'};result.requestLog=s.audit;
    s.phase='complete';s.draft=null;s.profiles={};await db.call('save_job',{owner,id,state:s,status:'complete',result});return job(owner,id);
   }
   if(h){s.httpCacheHits+=h.hits;s.audit.push(...h.audit)}await db.call('save_job',{owner,id,state:s,status:'running'});return job(owner,id);
  }catch(e){if(e instanceof Yield){if(h){j.state.httpCacheHits+=h.hits;j.state.audit.push(...h.audit)}await db.call('save_job',{owner,id,state:j.state,status:'running'});return job(owner,id)}await db.call('save_job',{owner,id,state:j.state,status:'error',error:String(e).slice(0,600)});return job(owner,id)}
  finally{await db.call('unlock',{key:'research',owner:token})}
 }
 async function anonymous(req:Request){
  const secret:string=await db.call('put_if_absent',{kind:'secret',id:'cookie-hmac',value:crypto.randomUUID()+crypto.randomUUID()}),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const sign=async(id:string)=>[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(id)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const old=req.headers.get('cookie')?.match(/(?:^|;\s*)__Host-atlasSid=([^;]+)/)?.[1],parts=old?.split('.');
  if(parts&&/^[a-f0-9-]{36}$/.test(parts[0])&&/^[a-f0-9]{64}$/.test(parts[1]??'')){const bytes=new Uint8Array(parts[1].match(/../g)!.map(x=>parseInt(x,16)));if(await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(parts[0])))return {owner:parts[0],cookie:null}}
  const id=crypto.randomUUID();return {owner:id,cookie:`__Host-atlasSid=${id}.${await sign(id)}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000`};
 }
 async function handle(req:Request):Promise<Response>{
  let cookie:string|null=null;const reply=(status:number,data:any)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
  try{
   const u=new URL(req.url),origin=req.headers.get('origin');if(origin&&![u.origin,...(config.allowedOrigins??[])].includes(origin))return reply(403,{error:'Origin not allowed'});
   if(req.headers.get('sec-fetch-site')==='cross-site')return reply(403,{error:'Same-site requests only'});
   const identity=config.owner?{owner:await config.owner(req),cookie:null}:await anonymous(req);if(!identity.owner)return reply(401,{error:'Unauthorized'});cookie=identity.cookie;
   if(!['GET','POST'].includes(req.method))return reply(405,{error:'GET or POST required'});
   const text=req.method==='POST'?await req.text():'';if(text.length>4096)return reply(413,{error:'Request too large'});
   const body:Json=req.method==='POST'?JSON.parse(text):Object.fromEntries(u.searchParams);
   if(req.method==='GET'&&!['status','search','job'].includes(body.action))return reply(405,{error:'Use POST for mutations'});
   if(body.action==='status')return reply(200,await status());
   if(body.action==='bootstrap')return reply(200,await bootstrapStep(db,{...config.index,fetcher:config.fetcher??config.index?.fetcher}));
   if(body.action==='search'&&typeof body.query==='string')return reply(200,await search(body.query));
   if(body.action==='query'&&typeof body.disease==='string'&&typeof body.requestId==='string')return reply(202,await query(identity.owner,body.disease,body.top_k??3,body.requestId));
   if(['job','advance'].includes(body.action)&&typeof body.jobId==='string'&&/^[a-f0-9]{32}$/.test(body.jobId)){const r=body.action==='job'?await job(identity.owner,body.jobId):await advance(identity.owner,body.jobId);return reply(r?200:404,r??{error:'Unknown job'})}
   return reply(400,{error:'Invalid Atlas action or fields'});
  }catch(e){return reply(e instanceof SyntaxError?400:/limit|budget|queue full/i.test(String(e))?429:500,{error:e instanceof Error?e.message:'Atlas request failed'})}
 }
 return {handle,status,search,query,job,advance,bootstrap:()=>bootstrapStep(db,{...config.index,fetcher:config.fetcher??config.index?.fetcher})};
}
