import { allPages } from '@/lib/server/pagination';
import { actor, checked, route } from '@/lib/server/context';
import { needsRenterOnboarding } from '@/lib/onboarding';
import type { Tenancy } from '@/lib/types';
export const dynamic='force-dynamic';
export async function GET() { return route(async()=>{
 const {client,db,profile,user}=await actor();
 checked((await db.rpc('generate_bills')).error);
 const tables=['profiles','rooms','tenancies','bills','payments','fund_events','settings'] as const;
 const results=await Promise.all(tables.map(table=>allPages<Record<string,unknown>>(async(from,to)=>{
  const columns=table==='profiles'?'id,username,full_name,phone,role,must_change_password':'*';
  const {data,error}=await client.from(table).select(columns).order('id').range(from,to);checked(error);
  return (data||[]) as unknown as Record<string,unknown>[];
 })));
 const data=Object.fromEntries(tables.map((table,i)=>[table,results[i]]));
 for(const t of data.tenancies as {first_bill_month:string}[]) t.first_bill_month=t.first_bill_month.slice(0,7);
 for(const b of data.bills as {period:string}[]) b.period=b.period.slice(0,7);
 const settings=(data.settings as Record<string,unknown>[])[0]; if(settings) delete settings.id;
 return {...data,settings,viewer:profile,onboarding_required:needsRenterOnboarding(profile,user.user_metadata,data.tenancies as Tenancy[]),today:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())};
 }); }
