create table public.profiles (id uuid primary key references auth.users on delete restrict, username text not null unique check(username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'), full_name text not null, phone text not null default '', role text not null check(role in ('owner','renter')), must_change_password boolean not null default true, auth_valid_after timestamptz not null default '-infinity');
create unique index one_owner on public.profiles(role) where role='owner';
create table public.rooms(id uuid primary key default gen_random_uuid(),name text not null unique,capacity integer not null check(capacity between 1 and 100),notes text not null default '');
create table public.tenancies(id uuid primary key default gen_random_uuid(),renter_id uuid not null references public.profiles,room_id uuid not null references public.rooms,monthly_rent integer not null check(monthly_rent>0),due_day integer not null check(due_day between 1 and 31),start_date date not null,first_bill_month date not null check(extract(day from first_bill_month)=1),end_date date,status text not null default 'active' check(status in ('active','ended')),advance_held integer not null default 0 check(advance_held>=0),deposit_held integer not null default 0 check(deposit_held>=0),check(first_bill_month>=date_trunc('month',start_date)::date),check(end_date is null or end_date>=start_date));
create unique index active_renter on public.tenancies(renter_id) where status='active';
create index tenancy_room on public.tenancies(room_id);
create table public.bills(id uuid primary key default gen_random_uuid(),tenancy_id uuid not null references public.tenancies,renter_id uuid not null references public.profiles,period date not null,due_date date not null,amount integer not null check(amount>0),status text not null default 'unpaid' check(status in ('unpaid','paid','void')),paid_at timestamptz,unique(tenancy_id,period));
create index bills_renter on public.bills(renter_id);
create table public.payments(id uuid primary key default gen_random_uuid(),bill_id uuid not null references public.bills,renter_id uuid not null references public.profiles,amount integer not null check(amount>0),method text not null check(method in ('cash','gcash','bank','deposit')),status text not null check(status in ('pending','approved','rejected','reversed')),reference text not null default '',proof_path text,received_on date not null,submitted_at timestamptz not null default now(),reviewed_at timestamptz,note text not null default '');
create unique index one_live_payment on public.payments(bill_id) where status in ('pending','approved');
create index payments_renter on public.payments(renter_id);
create table public.fund_events(id uuid primary key default gen_random_uuid(),tenancy_id uuid not null references public.tenancies,kind text not null check(kind in ('advance_received','deposit_received','advance_refunded','deposit_refunded','deposit_applied')),amount integer not null check(amount>0),date date not null default (now() at time zone 'Asia/Manila')::date,note text not null default '');
create index funds_tenancy on public.fund_events(tenancy_id);
create unique index one_fund_receipt on public.fund_events(tenancy_id,kind) where kind in ('advance_received','deposit_received');
create table public.settings(id boolean primary key default true check(id),property_name text not null default 'Rentmate',gcash_name text not null default '',gcash_number text not null default '',gcash_qr_path text,bank_details text not null default '');
insert into public.settings(id) values(true);
create schema if not exists private;
create function private.ready() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=(select auth.uid()) and not must_change_password and exists(select 1 from auth.sessions s where s.user_id=profiles.id and s.id=(auth.jwt()->>'session_id')::uuid and s.created_at>profiles.auth_valid_after)) $$;
create function private.owner() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=(select auth.uid()) and role='owner' and not must_change_password and exists(select 1 from auth.sessions s where s.user_id=profiles.id and s.id=(auth.jwt()->>'session_id')::uuid and s.created_at>profiles.auth_valid_after)) $$;
revoke all on schema private from public; grant usage on schema private to authenticated;
revoke all on function private.ready(),private.owner() from public; grant execute on function private.ready(),private.owner() to authenticated;
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.tenancies enable row level security;
alter table public.bills enable row level security;
alter table public.payments enable row level security;
alter table public.fund_events enable row level security;
alter table public.settings enable row level security;
grant select on public.profiles,public.rooms,public.tenancies,public.bills,public.payments,public.fund_events,public.settings to authenticated;
revoke insert,update,delete on public.profiles,public.rooms,public.tenancies,public.bills,public.payments,public.fund_events,public.settings from anon,authenticated;
create policy profiles_read on public.profiles for select to authenticated using ((select private.ready()) and (id=(select auth.uid()) or (select private.owner())));
create policy rooms_read on public.rooms for select to authenticated using ((select private.owner()) or ((select private.ready()) and exists(select 1 from public.tenancies t where t.room_id=rooms.id and t.renter_id=(select auth.uid()))));
create policy tenancy_read on public.tenancies for select to authenticated using ((select private.ready()) and (renter_id=(select auth.uid()) or (select private.owner())));
create policy bills_read on public.bills for select to authenticated using ((select private.ready()) and (renter_id=(select auth.uid()) or (select private.owner())));
create policy payments_read on public.payments for select to authenticated using ((select private.ready()) and (renter_id=(select auth.uid()) or (select private.owner())));
create policy funds_read on public.fund_events for select to authenticated using ((select private.owner()) or ((select private.ready()) and exists(select 1 from public.tenancies t where t.id=fund_events.tenancy_id and t.renter_id=(select auth.uid()))));
create policy settings_read on public.settings for select to authenticated using ((select private.ready()));

create function public.session_allowed(actor uuid, session uuid) returns boolean language sql security definer set search_path='' as $$ select exists(select 1 from public.profiles p join auth.sessions s on s.user_id=p.id where p.id=actor and s.id=session and s.created_at>p.auth_valid_after) $$;
revoke all on function public.session_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.session_allowed(uuid,uuid) to service_role;

create function public.generate_bills() returns void language plpgsql security invoker set search_path='' as $$
declare t public.tenancies; m date; d date; today date := (now() at time zone 'Asia/Manila')::date;
begin
 for t in select * from public.tenancies where status='active' for update loop
  m:=t.first_bill_month;
  while m<=today+3 loop
   d:=m+least(t.due_day-1,extract(day from (m+interval '1 month - 1 day'))::integer-1);
   if m=t.first_bill_month then d:=greatest(d,t.start_date); end if;
   if d<=today+3 then insert into public.bills(tenancy_id,renter_id,period,due_date,amount) values(t.id,t.renter_id,m,d,t.monthly_rent) on conflict(tenancy_id,period) do nothing; end if;
   m:=(m+interval '1 month')::date;
  end loop;
 end loop;
end $$;

create function public.apply_action(actor uuid, a jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare p public.profiles; t public.tenancies; b public.bills; pay public.payments; r public.rooms; typ text:=a->>'type'; n integer; k text; held integer; target uuid;
begin
 select * into p from public.profiles where id=actor for update;
 if p.id is null or p.must_change_password then raise exception 'Unauthorized'; end if;
 if p.role<>'owner' and typ<>'payment.submit' then raise exception 'Owner required'; end if;
 if typ='room.save' then
  if a->>'id' is null then insert into public.rooms(name,capacity,notes) values(a->>'name',(a->>'capacity')::int,a->>'notes');
  else
   select * into r from public.rooms where id=(a->>'id')::uuid for update;
   if r.id is null or (select count(*) from public.tenancies where room_id=r.id and status='active')>(a->>'capacity')::int then raise exception 'Capacity'; end if;
   update public.rooms set name=a->>'name',capacity=(a->>'capacity')::int,notes=a->>'notes' where id=r.id;
  end if;
 elsif typ='renter.create' then
  select * into r from public.rooms where id=(a->>'room_id')::uuid for update;
  if r.id is null or (select count(*) from public.tenancies where room_id=r.id and status='active')>=r.capacity then raise exception 'Room full'; end if;
  target:=(a->>'renter_id')::uuid;
  insert into public.profiles(id,username,full_name,phone,role) values(target,a->>'username',a->>'full_name',a->>'phone','renter');
  insert into public.tenancies(renter_id,room_id,monthly_rent,due_day,start_date,first_bill_month,advance_held,deposit_held) values(target,r.id,(a->>'monthly_rent')::int,(a->>'due_day')::int,(a->>'start_date')::date,(a->>'first_bill_month')::date,case when (a->>'advance_received')::boolean then (a->>'monthly_rent')::int else 0 end,case when (a->>'deposit_received')::boolean then (a->>'monthly_rent')::int else 0 end) returning * into t;
  if t.advance_held>0 then insert into public.fund_events(tenancy_id,kind,amount) values(t.id,'advance_received',t.advance_held); end if;
  if t.deposit_held>0 then insert into public.fund_events(tenancy_id,kind,amount) values(t.id,'deposit_received',t.deposit_held); end if;
 elsif typ='renter.update' then
  select * into t from public.tenancies where renter_id=(a->>'id')::uuid and status='active' for update;
  select * into r from public.rooms where id=(a->>'room_id')::uuid for update;
  if t.id is null or r.id is null or (select count(*) from public.tenancies where room_id=r.id and status='active' and id<>t.id)>=r.capacity then raise exception 'Room unavailable'; end if;
  update public.profiles set full_name=a->>'full_name',phone=a->>'phone' where id=t.renter_id;
  update public.tenancies set room_id=r.id,monthly_rent=(a->>'monthly_rent')::int,due_day=(a->>'due_day')::int where id=t.id;
 elsif typ in ('payment.submit','payment.record') then
  select * into b from public.bills where id=(a->>'bill_id')::uuid for update;
  select * into t from public.tenancies where id=b.tenancy_id for update;
  if b.id is null or b.status<>'unpaid' then raise exception 'Bill not unpaid'; end if;
  if typ='payment.submit' and (p.role<>'renter' or b.renter_id<>actor or t.status<>'active' or a->>'method' not in ('gcash','bank') or coalesce(a->>'proof_path','')='') then raise exception 'Invalid proof'; end if;
  if (a->>'received_on')::date>(now() at time zone 'Asia/Manila')::date then raise exception 'Future payment'; end if;
  insert into public.payments(bill_id,renter_id,amount,method,status,reference,proof_path,received_on,reviewed_at,note) values(b.id,b.renter_id,b.amount,a->>'method',case when typ='payment.submit' then 'pending' else 'approved' end,a->>'reference',case when typ='payment.submit' then a->>'proof_path' else null end,(a->>'received_on')::date,case when typ='payment.record' then now() else null end,a->>'note');
  if typ='payment.record' then update public.bills set status='paid',paid_at=now() where id=b.id; end if;
 elsif typ in ('payment.review','payment.reverse') then
  select * into pay from public.payments where id=(a->>'id')::uuid;
  select * into b from public.bills where id=pay.bill_id for update;
  select * into pay from public.payments where id=(a->>'id')::uuid for update;
  if pay.id is null then raise exception 'Missing payment'; end if;
  if typ='payment.review' then
   if pay.status<>'pending' or b.status<>'unpaid' then raise exception 'Already reviewed'; end if;
   if (a->>'approve')::boolean then
    update public.payments set status='approved',reviewed_at=now() where id=pay.id;
    update public.bills set status='paid',paid_at=now() where id=b.id;
   else
    if length(trim(a->>'reason'))=0 then raise exception 'Reason required'; end if;
    update public.payments set status='rejected',reviewed_at=now(),note=concat(note,E'\nRejected: ',a->>'reason') where id=pay.id;
   end if;
  else
   if pay.status<>'approved' or pay.method='deposit' or length(trim(a->>'reason'))=0 then raise exception 'Cannot reverse'; end if;
   update public.payments set status='reversed',reviewed_at=now(),note=concat(note,E'\nReversed: ',a->>'reason') where id=pay.id;
   update public.bills set status=case when exists(select 1 from public.tenancies x where x.id=b.tenancy_id and x.status='ended' and b.due_date>x.end_date) then 'void' else 'unpaid' end,paid_at=null where id=b.id;
  end if;
 elsif typ='fund.record' then
  select * into t from public.tenancies where id=(a->>'tenancy_id')::uuid for update;
  k:=a->>'kind'; n:=(a->>'amount')::int;
  if t.id is null or n<=0 then raise exception 'Invalid fund'; end if;
  held:=case when k like 'advance_%' then t.advance_held else t.deposit_held end;
  if k like '%_received' then
   if t.status<>'active' or n<>t.monthly_rent then raise exception 'Receipt must equal one month'; end if;
   held:=held+n;
  else
   if n>held then raise exception 'Refund exceeds held'; end if; held:=held-n;
  end if;
  insert into public.fund_events(tenancy_id,kind,amount,note) values(t.id,k,n,a->>'note');
  update public.tenancies set advance_held=case when k like 'advance_%' then held else advance_held end,deposit_held=case when k like 'deposit_%' then held else deposit_held end where id=t.id;
 elsif typ='tenancy.end' then
  select * into t from public.tenancies where id=(a->>'id')::uuid for update;
  if t.id is null or t.status<>'active' or (a->>'end_date')::date<t.start_date or (a->>'end_date')::date>(now() at time zone 'Asia/Manila')::date then raise exception 'Invalid move-out'; end if;
  perform 1 from public.bills where tenancy_id=t.id for update;
  if exists(select 1 from public.payments q join public.bills x on x.id=q.bill_id where x.tenancy_id=t.id and q.status='pending') then raise exception 'Resolve pending proofs'; end if;
  if (a->>'apply_deposit')::boolean then
   select * into b from public.bills where id=(a->>'final_bill_id')::uuid and tenancy_id=t.id for update;
   if b.id is null or b.status<>'unpaid' or b.amount>t.deposit_held or b.period<> (select max(period) from public.bills where tenancy_id=t.id and due_date<=(a->>'end_date')::date and status<>'void') then raise exception 'Invalid final bill'; end if;
   insert into public.payments(bill_id,renter_id,amount,method,status,received_on,reviewed_at,note) values(b.id,t.renter_id,b.amount,'deposit','approved',(a->>'end_date')::date,now(),'Deposit applied at move-out');
   insert into public.fund_events(tenancy_id,kind,amount,note) values(t.id,'deposit_applied',b.amount,'Final bill');
   update public.bills set status='paid',paid_at=now() where id=b.id;
   t.deposit_held:=t.deposit_held-b.amount;
  end if;
  if (a->>'refund_advance')::boolean and t.advance_held>0 then insert into public.fund_events(tenancy_id,kind,amount) values(t.id,'advance_refunded',t.advance_held); t.advance_held:=0; end if;
  if (a->>'refund_deposit')::boolean and t.deposit_held>0 then insert into public.fund_events(tenancy_id,kind,amount) values(t.id,'deposit_refunded',t.deposit_held); t.deposit_held:=0; end if;
  update public.tenancies set status='ended',end_date=(a->>'end_date')::date,advance_held=t.advance_held,deposit_held=t.deposit_held where id=t.id;
  update public.bills set status='void' where tenancy_id=t.id and status='unpaid' and due_date>(a->>'end_date')::date;
 elsif typ='settings.save' then
  update public.settings set property_name=a->>'property_name',gcash_name=a->>'gcash_name',gcash_number=a->>'gcash_number',bank_details=a->>'bank_details' where id;
 else raise exception 'Unknown action';
 end if;
end $$;
revoke all on function public.generate_bills(),public.apply_action(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.generate_bills(),public.apply_action(uuid,jsonb) to service_role;
grant all on public.profiles,public.rooms,public.tenancies,public.bills,public.payments,public.fund_events,public.settings to service_role;

-- Supabase-only infrastructure (the SQL tests stub auth and omit this section).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('rentmate-private','rentmate-private',false,4194304,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create extension if not exists pg_cron;
select cron.schedule('rentmate-daily-bills','5 16 * * *','select public.generate_bills()');
