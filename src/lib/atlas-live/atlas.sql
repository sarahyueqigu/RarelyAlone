-- Run once in the existing PostgreSQL database. No edge-function deployment is needed.
create table if not exists atlas_data(ns text not null,kind text not null,id text not null,payload jsonb not null,expires timestamptz,updated timestamptz not null default now(),primary key(ns,kind,id));
create index if not exists atlas_data_disease on atlas_data(ns,kind,(payload->>'disease'));
create index if not exists atlas_data_alias on atlas_data(ns,kind,(payload->>'alias'));
create index if not exists atlas_data_gene on atlas_data(ns,kind,(payload->>'gene'));
create table if not exists atlas_features(version text not null,disease text not null,dimension text not null,feature text not null,value double precision not null,origin text not null,primary key(version,disease,dimension,feature,origin));
create index if not exists atlas_features_lookup on atlas_features(version,dimension,feature,disease);
create table if not exists atlas_jobs(id text primary key,owner text not null,request_key text not null,disease text not null,top_k int not null,state jsonb not null,status text not null default 'queued',result jsonb,error text,created timestamptz not null default now(),updated timestamptz not null default now(),unique(owner,request_key));
create index if not exists atlas_jobs_owner on atlas_jobs(owner,created);
create table if not exists atlas_locks(id text primary key,owner text not null,until_at timestamptz not null);
create table if not exists atlas_charges(job text not null,key text not null,kind text not null,reserved double precision not null default 0,actual double precision,status text not null default 'reserved',created timestamptz not null default now(),primary key(job,key,kind));
alter table atlas_data enable row level security;
alter table atlas_features enable row level security;
alter table atlas_jobs enable row level security;
alter table atlas_locks enable row level security;
alter table atlas_charges enable row level security;

create or replace function atlas_rpc(op text,p jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v text:=p->>'version'; ns_ text:=coalesce(p->>'ns','global'); ans jsonb; map_row record; j atlas_jobs; n int; cost double precision; query_text text; old_id text; new_id text; claimed text;
begin
 if op='get' then
  select payload into ans from atlas_data where ns=ns_ and kind=p->>'kind' and id=p->>'id' and (expires is null or expires>now());return ans;
 elsif op='put' then
  insert into atlas_data(ns,kind,id,payload,expires) values(ns_,p->>'kind',p->>'id',p->'value',(p->>'expires')::timestamptz) on conflict(ns,kind,id) do update set payload=excluded.payload,expires=excluded.expires,updated=now();return p->'value';
 elsif op='put_if_absent' then
  insert into atlas_data(ns,kind,id,payload) values(ns_,p->>'kind',p->>'id',p->'value') on conflict do nothing;
  select payload into ans from atlas_data where ns=ns_ and kind=p->>'kind' and id=p->>'id';return ans;
 elsif op='rows' then
  select coalesce(jsonb_agg(t.payload order by t.id),'[]') into ans from (select id,payload from atlas_data where ns=ns_ and kind=p->>'kind' and id>coalesce(p->>'after','') and (not(p?'ids') or id in(select jsonb_array_elements_text(p->'ids'))) and (not(p?'filter') or payload@>(p->'filter')) order by id limit least(coalesce((p->>'limit')::int,1000),2000))t;return ans;
 elsif op='ingest' then
  insert into atlas_data(ns,kind,id,payload) select distinct on (x->>'kind',x->>'id') ns_,x->>'kind',x->>'id',x->'payload' from jsonb_array_elements(coalesce(p->'rows','[]')) with ordinality as r(x,ord_) order by x->>'kind',x->>'id',ord_ desc on conflict(ns,kind,id) do update set payload=excluded.payload,updated=now();return 'true';
 elsif op='hpo_features' then
  with recursive seed as (select x->>'disease' disease,x->>'term' feature from jsonb_array_elements(p->'rows')x), walk(disease,feature,value) as (
   select disease,feature,1::double precision from seed union
   select w.disease,par.value,.45 from walk w join atlas_data t on t.ns=v and t.kind='term' and t.id=w.feature cross join lateral jsonb_array_elements_text(coalesce(t.payload->'parents','[]'))par
  ) insert into atlas_features select v,disease,'phenotype',feature,max(value),'index' from walk where feature not in('HP:0000001','HP:0000118') group by disease,feature on conflict(version,disease,dimension,feature,origin) do update set value=greatest(atlas_features.value,excluded.value);return 'true';
 elsif op='features' then
  if coalesce((p->>'replace')::boolean,false) then delete from atlas_features where version=v and disease=p->>'disease' and origin=p->>'origin';end if;
  insert into atlas_features select v,x->>'disease',x->>'dimension',x->>'feature',max((x->>'value')::double precision),x->>'origin' from jsonb_array_elements(coalesce(p->'rows','[]'))x group by x->>'disease',x->>'dimension',x->>'feature',x->>'origin' on conflict(version,disease,dimension,feature,origin) do update set value=greatest(atlas_features.value,excluded.value);return 'true';
 elsif op='canonicalize' then
  for map_row in select key,value#>>'{}' target from jsonb_each(p->'mapping') loop
   old_id:=map_row.key;new_id:=map_row.target;if old_id=new_id then continue;end if;
   insert into atlas_data(ns,kind,id,payload) values(v,'equivalent',old_id,jsonb_build_object('id',old_id,'canonical',new_id)) on conflict(ns,kind,id) do update set payload=excluded.payload;
   update atlas_data set payload=jsonb_set(payload,'{disease}',to_jsonb(new_id)) where ns=v and kind in('hpo','gene','alias') and payload->>'disease'=old_id;
   insert into atlas_features select version,new_id,dimension,feature,max(value),origin from atlas_features where version=v and disease=old_id group by version,dimension,feature,origin on conflict(version,disease,dimension,feature,origin) do update set value=greatest(atlas_features.value,excluded.value);
   delete from atlas_features where version=v and disease=old_id;delete from atlas_data where ns=v and kind='disease' and id=old_id;
  end loop;return 'true';
 elsif op='pathway_features' then
  with diseases as (select id from atlas_data where ns=v and kind='disease' and id>coalesce(p->>'after','') order by id limit 100), selected as (
   select distinct g.payload->>'disease' disease,r.payload->>'pathway' feature from atlas_data g join diseases d on d.id=g.payload->>'disease' join atlas_data r on r.ns=v and r.kind='reactome' and r.payload->>'gene'=g.payload->>'gene' where g.ns=v and g.kind='gene'
  ) insert into atlas_features select v,disease,'pathway',feature,.45,'index' from selected on conflict(version,disease,dimension,feature,origin) do update set value=greatest(atlas_features.value,excluded.value);
  select coalesce(jsonb_agg(t.id),'[]') into ans from(select id from atlas_data where ns=v and kind='disease' and id>coalesce(p->>'after','') order by id limit 100)t;return ans;
 elsif op='search' then
  query_text:=p->>'query';select coalesce(jsonb_agg(payload),'[]') into ans from(select distinct d.payload from atlas_data a join atlas_data d on d.ns=v and d.kind='disease' and d.id=a.payload->>'disease' where a.ns=v and a.kind='alias' and a.payload->>'alias'=query_text limit 12)t;
  if jsonb_array_length(ans)=0 then select coalesce(jsonb_agg(payload),'[]') into ans from(select distinct d.payload,length(d.payload->>'name') len,d.id from atlas_data a join atlas_data d on d.ns=v and d.kind='disease' and d.id=a.payload->>'disease' where a.ns=v and a.kind='alias' and position(query_text in a.payload->>'alias')>0 order by len,d.id limit 12)t;end if;return ans;
 elsif op='materialize' then
  select payload into ans from atlas_data where ns=v and kind='disease' and id=p->>'id';if ans is null then raise exception 'Unknown exact disease ID';end if;
  return jsonb_build_object('disease',ans,'aliases',coalesce((select jsonb_agg(distinct payload->>'alias') from atlas_data where ns=v and kind='alias' and payload->>'disease'=p->>'id'),'[]'),
   'hpo',coalesce((select jsonb_agg(h.payload||jsonb_build_object('label',coalesce(t.payload->>'name',h.payload->>'term'))) from atlas_data h left join atlas_data t on t.ns=v and t.kind='term' and t.id=h.payload->>'term' where h.ns=v and h.kind='hpo' and h.payload->>'disease'=p->>'id'),'[]'),
   'genes',coalesce((select jsonb_agg(distinct payload) from atlas_data where ns=v and kind='gene' and payload->>'disease'=p->>'id'),'[]'),
   'pathways',coalesce((select jsonb_agg(distinct r.payload) from atlas_data g join atlas_data r on r.ns=v and r.kind='reactome' and r.payload->>'gene'=g.payload->>'gene' where g.ns=v and g.kind='gene' and g.payload->>'disease'=p->>'id'),'[]'));
 elsif op='stats' then
  return jsonb_build_object('diseases',(select count(*) from atlas_data where ns=v and kind='disease'),'annotations',(select count(*) from atlas_data where ns=v and kind='hpo'),'exactMappingsMerged',(select count(*) from atlas_data where ns=v and kind='equivalent'));
 elsif op='df' then
  select coalesce(jsonb_object_agg(dimension||'|'||feature,df),'{}') into ans from(select dimension,feature,count(distinct disease)df from atlas_features where version=v and feature in(select jsonb_array_elements_text(p->'ids')) group by dimension,feature)t;return ans;
 elsif op='shortlist' then
  select count(*) into n from atlas_data where ns=v and kind='disease';
  with qs as(select dimension,feature,max(value)value from atlas_features where version=v and disease=p->>'disease' group by dimension,feature), posting as(
   select f.dimension,f.feature,f.disease,max(f.value)value from atlas_features f join qs q on q.dimension=f.dimension and q.feature=f.feature where f.version=v group by f.dimension,f.feature,f.disease
  ), freq as(select dimension,feature,count(*)df from posting group by dimension,feature), scores as(
   select f.dimension,f.disease,sum((ln((n+1.)/(df+1.))+.01)*least(q.value,f.value))score from posting f join qs q using(dimension,feature) join freq using(dimension,feature) where f.disease<>p->>'disease' and (n<=50 or df::double precision/n<=.25) group by f.dimension,f.disease
  ), ranked as(select *,row_number() over(partition by dimension order by score desc,disease)rank from scores), combined as(
   select disease,sum((case when dimension='gene' then .4 else 1 end)/(60+rank))score,jsonb_agg(dimension order by dimension)channels from ranked group by disease
  ) select coalesce(jsonb_agg(t.payload order by t.score desc,t.id),'[]') into ans from(select d.id,c.score,jsonb_build_object('id',d.id,'name',d.payload->>'name','retrievalScore',c.score,'channels',c.channels,'status','candidate_only')payload from combined c join atlas_data d on d.ns=v and d.kind='disease' and d.id=c.disease order by c.score desc,d.id limit coalesce((p->>'limit')::int,40))t;return ans;
 elsif op='literature_candidates' then
  select coalesce(jsonb_agg(t.payload),'[]') into ans from(select distinct d.id,jsonb_build_object('id',d.id,'name',d.payload->>'name','retrievalScore',0,'channels',jsonb_build_array('literature_mention'),'status','candidate_only')payload from atlas_data a join atlas_data d on d.ns=v and d.kind='disease' and d.id=a.payload->>'disease' where a.ns=v and a.kind='alias' and length(a.payload->>'alias')>=10 and position(' ' in a.payload->>'alias')>0 and position(' '||(a.payload->>'alias')||' ' in ' '||(p->>'text')||' ')>0 and d.id<>p->>'disease' and d.id not in(select jsonb_array_elements_text(p->'exclude')) order by d.id limit 100)t;return ans;
 elsif op='vocabulary' then
  select coalesce(jsonb_agg(t.payload),'[]') into ans from(select id,payload,(select count(*) from jsonb_array_elements_text(p->'tokens')tok where position(tok in lower(payload->>'label'))>0)score from atlas_data where ns='graph' and kind='node' and payload->>'type'<>'disease' order by score desc,id limit 70)t;return ans;
 elsif op='lock' then
  insert into atlas_locks values(p->>'key',p->>'owner',now()+make_interval(secs=>coalesce((p->>'seconds')::int,120))) on conflict(id) do update set owner=excluded.owner,until_at=excluded.until_at where atlas_locks.until_at<now() or atlas_locks.owner=excluded.owner returning owner into claimed;return to_jsonb(claimed is not null);
 elsif op='unlock' then
  delete from atlas_locks where id=p->>'key' and owner=p->>'owner';return 'true';
 elsif op='enqueue' then
  perform pg_advisory_xact_lock(684321);
  select * into j from atlas_jobs where owner=p->>'owner' and request_key=p->>'requestId';
  if found then if j.disease<>p->>'disease' or j.top_k<>(p->>'top_k')::int then raise exception 'requestId already used for another query';end if;return jsonb_build_object('jobId',j.id);end if;
  if (select count(*) from atlas_jobs where owner=p->>'owner' and created>now()-interval '1 day')>=coalesce((p->>'perDay')::int,10) then raise exception 'Daily user job limit reached';end if;
  if (select count(*) from atlas_jobs where created>now()-interval '1 day')>=coalesce((p->>'globalPerDay')::int,100) then raise exception 'Global daily job limit reached';end if;
  if (select count(*) from atlas_jobs where status in('queued','running'))>=20 then raise exception 'Research queue full';end if;
  insert into atlas_jobs(id,owner,request_key,disease,top_k,state) values(p->>'id',p->>'owner',p->>'requestId',p->>'disease',(p->>'top_k')::int,p->'state');return jsonb_build_object('jobId',p->>'id');
 elsif op='job' then
  select * into j from atlas_jobs where id=p->>'id' and owner=p->>'owner';if not found then return null;end if;
  return jsonb_build_object('jobId',j.id,'status',j.status,'state',j.state,'result',j.result,'error',j.error,'createdAt',j.created,'updatedAt',j.updated);
 elsif op='save_job' then
  update atlas_jobs set state=coalesce(p->'state',state),status=coalesce(p->>'status',status),result=coalesce(p->'result',result),error=p->>'error',updated=now() where id=p->>'id' and owner=p->>'owner';return to_jsonb(found);
 elsif op='reserve' then
  perform pg_advisory_xact_lock(684322);
  if exists(select 1 from atlas_charges where job=p->>'job' and key=p->>'key' and kind=p->>'kind') then return 'false';end if;
  select count(*),coalesce(sum(coalesce(actual,reserved)),0) into n,cost from atlas_charges where job=p->>'job' and kind=p->>'kind';
  if n>=coalesce((p->>'maxCalls')::int,12) then raise exception 'Request/call budget exhausted';end if;
  if p->>'kind'='llm' and (cost+(p->>'reserve')::double precision>coalesce((p->>'maxUSD')::double precision,.5) or (select coalesce(sum(coalesce(actual,reserved)),0) from atlas_charges where kind='llm' and created>now()-interval '1 day')+(p->>'reserve')::double precision>coalesce((p->>'globalUSD')::double precision,5)) then raise exception 'Model spending budget exhausted';end if;
  insert into atlas_charges(job,key,kind,reserved)values(p->>'job',p->>'key',p->>'kind',coalesce((p->>'reserve')::double precision,0));return 'true';
 elsif op='settle' then
  update atlas_charges set actual=(p->>'actual')::double precision,status='complete' where job=p->>'job' and key=p->>'key' and kind=p->>'kind';return 'true';
 elsif op='cost' then
  return jsonb_build_object('httpRequests',(select count(*) from atlas_charges where job=p->>'job' and kind='http'),'llmCalls',(select count(*) from atlas_charges where job=p->>'job' and kind='llm'),'estimatedOrReservedUSD',(select coalesce(sum(coalesce(actual,reserved)),0) from atlas_charges where job=p->>'job' and kind='llm'));
 else raise exception 'Unknown Atlas database operation: %',op;
 end if;
end;$$;
revoke all on function atlas_rpc(text,jsonb) from public;
revoke all on atlas_data,atlas_features,atlas_jobs,atlas_locks,atlas_charges from public;
do $$declare role_ text;begin
 foreach role_ in array array['anon','authenticated'] loop if exists(select 1 from pg_roles where rolname=role_) then execute format('revoke all on function atlas_rpc(text,jsonb) from %I',role_);execute format('revoke all on atlas_data,atlas_features,atlas_jobs,atlas_locks,atlas_charges from %I',role_);end if;end loop;
 if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function atlas_rpc(text,jsonb) to service_role;end if;
end;$$;
