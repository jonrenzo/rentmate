import type { Action, AppState, Bill, Payment, Tenancy } from './types';

import { randomId as id } from './id';
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function amount(value: number) { requireValue(Number.isSafeInteger(value) && value > 0 && value <= 100000000, 'Enter a valid positive amount.'); }
function date(value: string) { requireValue(/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value, 'Enter a valid date.'); }
function period(value: string) { requireValue(/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= '2000-01' && value <= '2100-12', 'Enter a valid billing month.'); }
function dueDay(value: number) { requireValue(Number.isInteger(value) && value >= 1 && value <= 31,'Due day must be 1–31.'); }
function required(value: string, label: string, max = 200) { requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label} is required (up to ${max} characters).`); }
export function manilaToday(now = new Date()): string { return new Date(now.getTime()+8*3600000).toISOString().slice(0,10); }
export function money(cents: number): string { return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2}).format(cents/100); }
export function monthLabel(value: string): string { period(value); return new Intl.DateTimeFormat('en-PH',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}-01`)); }
export function dueDate(value: string, day: number): string { period(value); dueDay(day); const [y,m]=value.split('-').map(Number); return `${value}-${String(Math.min(day,new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0')}`; }
function nextMonth(value: string): string { const d=new Date(`${value}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth()+1); return d.toISOString().slice(0,7); }
export function generateBills(state: AppState, today = manilaToday()): AppState {
  date(today); const out=structuredClone(state); out.today=today;
  const cutoff=new Date(`${today}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate()+3); const until=cutoff.toISOString().slice(0,10);
  for(const t of out.tenancies) {
    if(t.status!=='active') continue;
    period(t.first_bill_month); date(t.start_date); amount(t.monthly_rent);
    for(let p=t.first_bill_month;p<=until.slice(0,7);p=nextMonth(p)) {
      const scheduled=dueDate(p,t.due_day); const due=p===t.first_bill_month && scheduled<t.start_date?t.start_date:scheduled;
      if(due>until || out.bills.some(b=>b.tenancy_id===t.id&&b.period===p)) continue;
      out.bills.push({id:id(),tenancy_id:t.id,renter_id:t.renter_id,period:p,due_date:due,amount:t.monthly_rent,status:'unpaid',paid_at:null});
    }
  }
  return out;
}
export function billStatus(bill: Bill,payments: Payment[],today: string): 'paid'|'pending'|'overdue'|'due'|'void' {
  if(bill.status==='paid'||bill.status==='void') return bill.status;
  if(payments.some(p=>p.bill_id===bill.id&&p.status==='pending')) return 'pending';
  return bill.due_date<today?'overdue':'due';
}
export function filterForViewer(state: AppState,viewerId: string): AppState {
  const out=structuredClone(state), viewer=out.profiles.find(p=>p.id===viewerId); requireValue(viewer,'Account not found.'); out.viewer={...viewer};
  if(viewer.role==='owner') return out;
  out.profiles=out.profiles.filter(p=>p.id===viewerId); out.tenancies=out.tenancies.filter(t=>t.renter_id===viewerId);
  out.rooms=out.rooms.filter(r=>out.tenancies.some(t=>t.room_id===r.id)); out.bills=out.bills.filter(b=>b.renter_id===viewerId);
  out.payments=out.payments.filter(p=>p.renter_id===viewerId); out.fund_events=out.fund_events.filter(e=>out.tenancies.some(t=>t.id===e.tenancy_id)); return out;
}
export function applyAction(state: AppState, action: Action): AppState {
  const actor=state.profiles.find(p=>p.id===state.viewer.id);
  requireValue(actor && actor.role===state.viewer.role,'Account not authorized.');
  requireValue(!actor.must_change_password && !state.viewer.must_change_password,'Change your temporary password first.');
  requireValue(actor.role==='owner'||action.type==='payment.submit','Only the owner can do this.');
  const s=structuredClone(state); date(s.today); const now=new Date().toISOString();
  const tenancy=(key:string) => { const t=s.tenancies.find(t=>t.id===key); requireValue(t,'Tenancy not found.'); return t; };
  const active=(t:Tenancy) => requireValue(t.status==='active','Moved-out accounts are read-only.');
  const capacity=(roomId:string,exclude?:string) => { const room=s.rooms.find(r=>r.id===roomId); requireValue(room,'Room not found.'); requireValue(s.tenancies.filter(t=>t.room_id===roomId&&t.status==='active'&&t.id!==exclude).length<room.capacity,'This room is full.'); };
  const payable=(key:string) => { const b=s.bills.find(b=>b.id===key); requireValue(b,'Bill not found.'); if(actor.role==='renter') active(tenancy(b.tenancy_id)); requireValue(b.status==='unpaid'&&!s.payments.some(p=>p.bill_id===key&&(p.status==='approved'||p.status==='pending')),'This bill is already paid or has a pending proof.'); return b; };
  const settle=(b:Bill,method:Payment['method'],received_on:string,reference:string,note:string,proof_path:string|null=null,pending=false) => {
    s.payments.push({id:id(),bill_id:b.id,renter_id:b.renter_id,amount:b.amount,method,status:pending?'pending':'approved',reference,proof_path,received_on,submitted_at:now,reviewed_at:pending?null:now,note});
    if(!pending){b.status='paid'; b.paid_at=now;}
  };
  const fund=(t:Tenancy,kind:AppState['fund_events'][number]['kind'],value:number,note:string) => {
    amount(value); const advance=kind.startsWith('advance'); const key=advance?'advance_held':'deposit_held';
    if(kind.endsWith('_received')) {requireValue(value===t.monthly_rent,'Initial funds must equal one month of rent.'); requireValue(!s.fund_events.some(e=>e.tenancy_id===t.id&&e.kind===kind),'This initial fund has already been received.'); t[key]+=value;}
    else {requireValue(value<=t[key],'Refund or application exceeds funds held.'); t[key]-=value;}
    s.fund_events.push({id:id(),tenancy_id:t.id,kind,amount:value,date:s.today,note});
  };
  switch(action.type) {
    case 'room.save': {
      required(action.name,'Room name',80); requireValue(Number.isInteger(action.capacity)&&action.capacity>=1&&action.capacity<=100,'Capacity must be 1–100.');
      requireValue(!s.rooms.some(r=>r.id!==action.id&&r.name.toLowerCase()===action.name.trim().toLowerCase()),'Room name already exists.');
      requireValue(s.tenancies.filter(t=>t.room_id===action.id&&t.status==='active').length<=action.capacity,'Capacity cannot be below current occupancy.');
      requireValue(action.notes.length<=2000,'Notes are too long.');
      if(action.id){const r=s.rooms.find(r=>r.id===action.id); requireValue(r,'Room not found.'); Object.assign(r,{name:action.name.trim(),capacity:action.capacity,notes:action.notes});}
      else s.rooms.push({id:id(),name:action.name.trim(),capacity:action.capacity,notes:action.notes}); break;
    }
    case 'renter.create': {
      requireValue(/^[a-z0-9][a-z0-9._-]{2,31}$/.test(action.username),'Username must start with a letter or number and contain 3–32 lowercase letters, numbers, dots, underscores or hyphens.');
      requireValue(!s.profiles.some(p=>p.username.toLowerCase()===action.username),'Username already exists.'); required(action.full_name,'Name',120); requireValue(action.phone.length<=40,'Phone is too long.');
      amount(action.monthly_rent); dueDay(action.due_day); date(action.start_date); period(action.first_bill_month);
      requireValue(action.first_bill_month>=action.start_date.slice(0,7),'First billing month cannot precede move-in.'); capacity(action.room_id);
      const renterId=id(); s.profiles.push({id:renterId,username:action.username,full_name:action.full_name.trim(),phone:action.phone,role:'renter',must_change_password:true});
      const t:Tenancy={id:id(),renter_id:renterId,room_id:action.room_id,monthly_rent:action.monthly_rent,due_day:action.due_day,start_date:action.start_date,first_bill_month:action.first_bill_month,end_date:null,status:'active',advance_held:0,deposit_held:0}; s.tenancies.push(t);
      if(action.advance_received) fund(t,'advance_received',t.monthly_rent,'Collected at move-in'); if(action.deposit_received) fund(t,'deposit_received',t.monthly_rent,'Collected at move-in');
      return generateBills(s,s.today);
    }
    case 'renter.update': {
      const p=s.profiles.find(p=>p.id===action.id&&p.role==='renter'),t=s.tenancies.find(t=>t.renter_id===action.id&&t.status==='active'); requireValue(p&&t,'Active renter not found.');
      required(action.full_name,'Name',120); requireValue(action.phone.length<=40,'Phone is too long.'); amount(action.monthly_rent); dueDay(action.due_day); capacity(action.room_id,t.id);
      Object.assign(p,{full_name:action.full_name.trim(),phone:action.phone}); Object.assign(t,{monthly_rent:action.monthly_rent,due_day:action.due_day,room_id:action.room_id}); break;
    }
    case 'password.reset': { const p=s.profiles.find(p=>p.id===action.renter_id&&p.role==='renter'); requireValue(p,'Renter not found.'); p.must_change_password=true; break; }
    case 'payment.record': case 'payment.submit': {
      const b=payable(action.bill_id); date(action.received_on); requireValue(action.received_on<=s.today,'Payment date cannot be in the future.');
      requireValue(action.reference.length<=200&&action.note.length<=2000,'Payment details are too long.');
      if(action.type==='payment.submit') {
        requireValue(actor.role==='renter'&&b.renter_id===actor.id,'You can only submit your own payment.'); requireValue(['gcash','bank'].includes(action.method),'Choose GCash or bank.'); required(action.reference,'Reference'); if(action.proof_path.startsWith('data:')) { requireValue(s.demo && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(action.proof_path) && action.proof_path.length<=1572864,'Use a PNG, JPEG or WebP demo image under 1 MB.'); } else required(action.proof_path,'Payment proof',1024);
        settle(b,action.method,action.received_on,action.reference,action.note,action.proof_path,true);
      } else {requireValue(['cash','gcash','bank'].includes(action.method),'Invalid payment method.'); settle(b,action.method,action.received_on,action.reference,action.note);}
      break;
    }
    case 'payment.review': {
      const p=s.payments.find(p=>p.id===action.id); requireValue(p&&p.status==='pending','Pending payment not found.'); const b=s.bills.find(b=>b.id===p.bill_id); requireValue(b&&b.status==='unpaid','Bill is no longer unpaid.'); if(actor.role==='renter') active(tenancy(b.tenancy_id));
      if(action.approve) {requireValue(p.amount===b.amount&&!s.payments.some(x=>x.bill_id===b.id&&x.status==='approved'),'Payment must settle the full unpaid bill.'); b.status='paid';b.paid_at=now;p.status='approved';}
      else {required(action.reason,'Rejection reason',2000);p.status='rejected';}
      p.reviewed_at=now; if(action.reason.trim()) p.note=[p.note,action.reason.trim()].filter(Boolean).join('\n'); break;
    }
    case 'payment.reverse': {
      required(action.reason,'Reversal reason',2000);const p=s.payments.find(p=>p.id===action.id); requireValue(p&&p.status==='approved','Approved payment not found.'); const b=s.bills.find(b=>b.id===p.bill_id); requireValue(b&&b.status==='paid','Paid bill not found.'); if(actor.role==='renter') active(tenancy(b.tenancy_id)); requireValue(p.method!=='deposit','Final deposit settlements cannot be reversed after move-out.');
      p.status='reversed'; p.reviewed_at=now;p.note=[p.note,`Reversed: ${action.reason.trim()}`].filter(Boolean).join('\n'); const t=tenancy(b.tenancy_id); b.status=t.status==='ended'&&t.end_date&&b.due_date>t.end_date?'void':'unpaid';b.paid_at=null;break;
    }
    case 'fund.record': { const t=tenancy(action.tenancy_id); if(action.kind.endsWith('_received')) active(t); requireValue(['advance_received','deposit_received','advance_refunded','deposit_refunded'].includes(action.kind),'Invalid fund event.'); requireValue(action.note.length<=2000,'Note is too long.'); fund(t,action.kind,action.amount,action.note);break; }
    case 'tenancy.end': {
      const t=tenancy(action.id); active(t);date(action.end_date);requireValue(action.end_date>=t.start_date&&action.end_date<=s.today,'Move-out must be between move-in and today.');
      requireValue(!s.payments.some(p=>s.bills.some(b=>b.id===p.bill_id&&b.tenancy_id===t.id)&&p.status==='pending'),'Resolve pending proofs before move-out.');
      if(action.apply_deposit){requireValue(action.final_bill_id,'Choose the final bill.'); const b=payable(action.final_bill_id);requireValue(b.tenancy_id===t.id,'Final bill must belong to this tenancy.'); const finalPeriod=s.bills.filter(x=>x.tenancy_id===t.id&&x.due_date<=action.end_date&&x.status!=='void').map(x=>x.period).sort().at(-1); requireValue(b.period===finalPeriod&&b.due_date<=action.end_date,'Choose the latest bill due on or before move-out.');requireValue(t.deposit_held>=b.amount,'Deposit must cover the full final bill.'); fund(t,'deposit_applied',b.amount,`Applied to ${b.period}`);settle(b,'deposit',action.end_date,'','Final rent paid from deposit');}
      if(action.refund_advance&&t.advance_held) fund(t,'advance_refunded',t.advance_held,'Refund recorded at move-out');
      if(action.refund_deposit&&t.deposit_held) fund(t,'deposit_refunded',t.deposit_held,'Refund recorded at move-out');
      t.status='ended';t.end_date=action.end_date; for(const b of s.bills) if(b.tenancy_id===t.id&&b.status==='unpaid'&&b.due_date>action.end_date) b.status='void'; break;
    }
    case 'settings.save': required(action.property_name,'Property name',120);requireValue(action.gcash_name.length<=120&&action.gcash_number.length<=40&&action.bank_details.length<=2000,'Payment instructions are too long.');Object.assign(s.settings,{property_name:action.property_name.trim(),gcash_name:action.gcash_name,gcash_number:action.gcash_number,bank_details:action.bank_details});break;
    default: throw new Error('Unsupported action.');
  }
  return s;
}



