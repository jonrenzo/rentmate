import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const owner='10000000-0000-4000-8000-000000000001', renter='10000000-0000-4000-8000-000000000002', other='10000000-0000-4000-8000-000000000003', room='20000000-0000-4000-8000-000000000001', tenancy='30000000-0000-4000-8000-000000000001';
const session='40000000-0000-4000-8000-000000000001';
async function setup() {
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now()); create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('session_id','${session}')$$; grant usage on schema auth to authenticated; grant execute on function auth.uid(),auth.jwt() to authenticated;`);
 await db.exec(readFileSync('supabase/migrations/20261015093045_rentmate.sql','utf8').split('-- Supabase-only infrastructure')[0]);
 await db.exec(`insert into auth.users values('${owner}'),('${renter}'),('${other}'); insert into public.profiles(id,username,full_name,role,must_change_password) values('${owner}','owner','Owner','owner',false),('${renter}','renter','Renter','renter',false),('${other}','other','Other','renter',false);insert into auth.sessions(id,user_id) values('${session}','${renter}');insert into public.rooms(id,name,capacity) values('${room}','Room 1',2); insert into public.tenancies(id,renter_id,room_id,monthly_rent,due_day,start_date,first_bill_month) values('${tenancy}','${renter}','${room}',500000,31,'2026-01-15','2026-01-01');`);
 return db;
}
async function action(db:PGlite,a:object,who=owner){await db.query('select public.apply_action($1,$2::jsonb)',[who,JSON.stringify(a)]);}
test('SQL billing, payment atomicity, RLS and funds',async()=>{
 const db=await setup();
 try {
  await db.exec('select public.generate_bills(); select public.generate_bills();');
  const bills=(await db.query<{id:string;period:string;due_date:string}>('select id,period::text,due_date::text from public.bills order by period')).rows;
  assert.equal(bills[1].due_date,'2026-02-28');assert.equal(bills[2].due_date,'2026-03-31');assert.equal(new Set(bills.map(b=>b.period)).size,bills.length);
  const submit={type:'payment.submit',bill_id:bills[0].id,method:'gcash',received_on:'2026-01-31',reference:'123',proof_path:'proof.png',note:''};
  await assert.rejects(action(db,submit,other));await action(db,submit,renter);await assert.rejects(action(db,submit,renter));
  let pay=(await db.query<{id:string;amount:number}>('select id,amount from public.payments')).rows[0];assert.equal(pay.amount,500000);
  await action(db,{type:'payment.review',id:pay.id,approve:false,reason:'Unreadable'});await action(db,submit,renter);
  pay=(await db.query<{id:string;amount:number}>("select id,amount from public.payments where status='pending'")).rows[0];
  await action(db,{type:'payment.review',id:pay.id,approve:true,reason:''});await assert.rejects(action(db,{type:'payment.review',id:pay.id,approve:true,reason:''}));
  assert.equal((await db.query<{status:string}>('select status from public.bills where id=$1',[bills[1].id])).rows[0].status,'unpaid');
  await action(db,{type:'payment.reverse',id:pay.id,reason:'Wrong reference'});assert.equal((await db.query<{status:string}>('select status from public.bills where id=$1',[bills[0].id])).rows[0].status,'unpaid');
  await assert.rejects(action(db,{type:'fund.record',tenancy_id:tenancy,kind:'deposit_received',amount:100,note:''}));
  await action(db,{type:'fund.record',tenancy_id:tenancy,kind:'deposit_received',amount:500000,note:''});
  await assert.rejects(action(db,{type:'fund.record',tenancy_id:tenancy,kind:'deposit_received',amount:500000,note:''}));
  await assert.rejects(action(db,{type:'fund.record',tenancy_id:tenancy,kind:'deposit_refunded',amount:500001,note:''}));
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${renter}',false);`);
  assert.equal((await db.query('select * from public.profiles')).rows.length,1);
  await db.exec(`reset role;update auth.sessions set user_id='${other}' where id='${session}';set role authenticated;select set_config('request.jwt.claim.sub','${other}',false);`);
  assert.equal((await db.query('select * from public.profiles')).rows.length,1);
  assert.equal((await db.query('select * from public.bills')).rows.length,0);
  assert.equal((await db.query('select * from public.payments')).rows.length,0);
  assert.equal((await db.query('select * from public.tenancies')).rows.length,0);
  assert.equal((await db.query('select * from public.fund_events')).rows.length,0);
  await db.exec(`reset role;update auth.sessions set user_id='${renter}' where id='${session}';set role authenticated;select set_config('request.jwt.claim.sub','${renter}',false);`);

  await assert.rejects(db.query(`select public.apply_action('${owner}','{"type":"settings.save"}')`));
  await assert.rejects(db.query("update public.profiles set must_change_password=false"));
  await db.exec(`reset role; update public.profiles set must_change_password=true where id='${renter}';set role authenticated;`);
  assert.equal((await db.query('select * from public.bills')).rows.length,0);
  await db.exec(`reset role;update public.profiles set must_change_password=false,auth_valid_after=now()+interval '1 second' where id='${renter}';set role authenticated;`);
  assert.equal((await db.query('select * from public.bills')).rows.length,0);
  await db.exec(`reset role;update public.profiles set auth_valid_after='-infinity' where id='${renter}';`);
  await action(db,submit,renter);
  const end={type:'tenancy.end',id:tenancy,end_date:'2026-09-30',final_bill_id:null,apply_deposit:false,refund_advance:false,refund_deposit:true};
  await assert.rejects(action(db,end));
  pay=(await db.query<{id:string;amount:number}>("select id,amount from public.payments where status='pending'")).rows[0];await action(db,{type:'payment.review',id:pay.id,approve:false,reason:'Cancelled'});
  await action(db,end);await assert.rejects(action(db,submit,renter));
  assert.equal((await db.query<{deposit_held:number}>('select deposit_held from public.tenancies')).rows[0].deposit_held,0);
  // A reversal cannot recreate rent owed after the recorded move-out date.
  const futureBill=crypto.randomUUID(); const futurePay=crypto.randomUUID();
  await db.query("insert into public.bills(id,tenancy_id,renter_id,period,due_date,amount,status) values($1,$2,$3,'2099-01-01','2099-01-31',500000,'paid')",[futureBill,tenancy,renter]);
  await db.query("insert into public.payments(id,bill_id,renter_id,amount,method,status,received_on) values($1,$2,$3,500000,'cash','approved','2026-09-01')",[futurePay,futureBill,renter]);
  await action(db,{type:'payment.reverse',id:futurePay,reason:'Correct early payment'});
  assert.equal((await db.query<{status:string}>('select status from public.bills where id=$1',[futureBill])).rows[0].status,'void');
 } finally {await db.close();}
});

test('SQL move-out applies exactly one full final bill and records the fund debit',async()=>{
 const db=await setup();
 try {
  await db.exec('select public.generate_bills()');
  await action(db,{type:'fund.record',tenancy_id:tenancy,kind:'deposit_received',amount:500000,note:''});
  const {rows}=await db.query<{id:string;today:string}>("select id,(now() at time zone 'Asia/Manila')::date::text today from public.bills where due_date<=(now() at time zone 'Asia/Manila')::date order by period desc");
  const end={type:'tenancy.end',id:tenancy,end_date:rows[0].today,final_bill_id:rows.at(-1)!.id,apply_deposit:true,refund_advance:false,refund_deposit:true};
  await assert.rejects(action(db,end));
  await action(db,{...end,final_bill_id:rows[0].id});
  assert.equal((await db.query<{deposit_held:number}>('select deposit_held from public.tenancies')).rows[0].deposit_held,0);
  assert.equal((await db.query<{amount:number}>("select amount from public.fund_events where kind='deposit_applied'")).rows[0].amount,500000);
  assert.equal((await db.query<{status:string;method:string}>('select status,method from public.payments')).rows[0].method,'deposit');
  await assert.rejects(action(db,{...end,final_bill_id:rows[0].id}));
 } finally {await db.close();}
});
