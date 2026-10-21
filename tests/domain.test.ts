import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, billStatus, dueDate, generateBills, manilaToday, filterForViewer } from '../lib/domain';
import type { AppState, Profile, Role } from '../lib/types';
import { randomId } from '../lib/id';

// ponytail: local fixture only, mirrors the shapes the live API returns.
function makeState(role: Role = 'owner'): AppState {
  const today=manilaToday(), current=today.slice(0,7), previousDate=new Date(`${current}-01T00:00:00Z`);
  previousDate.setUTCMonth(previousDate.getUTCMonth()-1); const previous=previousDate.toISOString().slice(0,7);
  const profiles:Profile[]=[
    {id:'owner',username:'owner',full_name:'Alex Reyes',phone:'',role:'owner',must_change_password:false},
    {id:'sofia',username:'sofia',full_name:'Sofia Garcia',phone:'0917 000 0101',role:'renter',must_change_password:false},
    {id:'miguel',username:'miguel',full_name:'Miguel Santos',phone:'0917 000 0102',role:'renter',must_change_password:false},
    {id:'isabel',username:'isabel',full_name:'Isabel Cruz',phone:'0917 000 0103',role:'renter',must_change_password:false},
  ];
  let state:AppState={viewer:{...profiles[role==='owner'?0:1]},onboarding_required:false,profiles,rooms:[
    {id:'room-101',name:'Room 101',capacity:2,notes:'Ground floor · courtyard side'},
    {id:'room-102',name:'Room 102',capacity:1,notes:'Ground floor'},
    {id:'room-201',name:'Room 201',capacity:2,notes:'Second floor · balcony'},
  ],tenancies:profiles.slice(1).map((p,i)=>({id:`tenancy-${p.id}`,renter_id:p.id,room_id:i===2?'room-201':'room-101',monthly_rent:i===2?750000:650000,due_day:Math.min(Number(today.slice(8)),i===0?5:i===1?10:15),start_date:`${previous}-01`,first_bill_month:previous,end_date:null,status:'active',advance_held:i===2?750000:650000,deposit_held:i===2?750000:650000})),bills:[],payments:[],fund_events:[],settings:{property_name:'The Courtyard',gcash_name:'Alex Reyes',gcash_number:'0917 000 0000',gcash_qr_path:null,bank_details:'Bank transfer details go here after setup.'},today};
  state=generateBills(state,today);
  for(const t of state.tenancies) for(const kind of ['advance_received','deposit_received'] as const) state.fund_events.push({id:randomId(),tenancy_id:t.id,kind,amount:t.monthly_rent,date:t.start_date,note:'Move-in receipt'});
  for(const bill of state.bills) {
    const isPaid=bill.period===previous&&bill.renter_id!=='sofia'||bill.period===current&&bill.renter_id==='isabel';
    const pending=bill.period===current&&bill.renter_id==='miguel';
    if(!isPaid&&!pending)continue;
    const timestamp=`${today}T02:00:00.000Z`;
    if(isPaid){bill.status='paid';bill.paid_at=timestamp;}
    state.payments.push({id:randomId(),bill_id:bill.id,renter_id:bill.renter_id,amount:bill.amount,method:pending?'gcash':'cash',status:pending?'pending':'approved',reference:pending?'PROOF-482019':'',proof_path:pending?'proofs/pending.png':null,received_on:today,submitted_at:timestamp,reviewed_at:pending?null:timestamp,note:'Recorded payment'});
  }
  return state;
}

test('records payments on HTTP without crypto.randomUUID', () => {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    const state = makeState();
    const bill = state.bills.find(b => b.status === 'unpaid' && !state.payments.some(p => p.bill_id === b.id && p.status === 'pending'))!;
    const paid = applyAction(state, { type: 'payment.record', bill_id: bill.id, method: 'cash', received_on: state.today, reference: '', note: '' });
    const ids = [...paid.bills, ...paid.payments, ...paid.fund_events].map(record => record.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(paid.bills.find(b => b.id === bill.id)?.status, 'paid');
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'randomUUID', descriptor);
    else Reflect.deleteProperty(crypto, 'randomUUID');
  }
});

test('Manila calendar and short-month clamping', () => {
  assert.equal(manilaToday(new Date('2026-01-31T16:00:00Z')), '2026-02-01');
  assert.equal(dueDate('2024-02',31),'2024-02-29');
  assert.equal(dueDate('2025-02',31),'2025-02-28');
});
test('generation catches next-month due dates, first move-in, preserves amount and is immutable', () => {
  const s=makeState(); s.bills=[]; s.payments=[]; s.tenancies=s.tenancies.slice(0,1);
  Object.assign(s.tenancies[0], {start_date:'2026-01-20',first_bill_month:'2026-01',due_day:1,monthly_rent:12345});
  const copy=structuredClone(s), next=generateBills(s,'2026-01-29');
  assert.deepEqual(s,copy); assert.deepEqual(next.bills.map(b=>b.due_date),['2026-01-20','2026-02-01']);
  next.tenancies[0].monthly_rent=99999;
  assert.equal(generateBills(next,'2026-01-29').bills[0].amount,12345);
  assert.equal(generateBills(next,'2026-01-29').bills.length,2);
  next.tenancies[0].status='ended'; assert.equal(generateBills(next,'2026-06-30').bills.length,2);
});
test('selected month only, duplicate payment denied, reversal retains history', () => {
  const s=makeState(); const bill=s.bills.find(b=>b.status==='unpaid'&&!s.payments.some(p=>p.bill_id===b.id&&p.status==='pending'))!;
  const original=structuredClone(s);
  const paid=applyAction(s,{type:'payment.record',bill_id:bill.id,method:'cash',received_on:s.today,reference:'',note:''});
  assert.deepEqual(s,original); assert.equal(paid.bills.find(b=>b.id===bill.id)?.status,'paid');
  assert.deepEqual(paid.bills.filter(b=>b.id!==bill.id),s.bills.filter(b=>b.id!==bill.id));
  assert.throws(()=>applyAction(paid,{type:'payment.record',bill_id:bill.id,method:'cash',received_on:s.today,reference:'',note:''}));
  const payment=paid.payments.at(-1)!;
  const reversed=applyAction(paid,{type:'payment.reverse',id:payment.id,reason:'Wrong month'});
  assert.equal(reversed.payments.at(-1)?.status,'reversed'); assert.equal(reversed.bills.find(b=>b.id===bill.id)?.status,'unpaid');
});
test('authorization, isolation, refunds and temporary-password gate',()=>{
  const s=makeState('renter');
  assert.throws(()=>applyAction(s,{type:'room.save',name:'X',capacity:1,notes:''}));
  assert.ok(filterForViewer(s,s.viewer.id).profiles.every(p=>p.id===s.viewer.id));
  s.viewer.role='owner'; assert.throws(()=>applyAction(s,{type:'room.save',name:'X',capacity:1,notes:''}));
  const owner=makeState(), t=owner.tenancies[0];
  assert.throws(()=>applyAction(owner,{type:'fund.record',tenancy_id:t.id,kind:'deposit_refunded',amount:t.deposit_held+1,note:''}));
  owner.viewer.must_change_password=true; assert.throws(()=>applyAction(owner,{type:'room.save',name:'X',capacity:1,notes:''}));
});
test('pending proof rejection and resubmission, move-out blocks pending',()=>{
  const s=makeState(); const p=s.payments.find(p=>p.status==='pending')!;
  assert.equal(billStatus(s.bills.find(b=>b.id===p.bill_id)!,s.payments,s.today),'pending');
  assert.throws(()=>applyAction(s,{type:'payment.review',id:p.id,approve:false,reason:''}));
  const t=s.tenancies.find(t=>t.renter_id===p.renter_id)!;
  assert.throws(()=>applyAction(s,{type:'tenancy.end',id:t.id,end_date:s.today,final_bill_id:null,apply_deposit:false,refund_advance:false,refund_deposit:false}));
  const rejected=applyAction(s,{type:'payment.review',id:p.id,approve:false,reason:'Unreadable receipt'});
  rejected.viewer=structuredClone(rejected.profiles.find(x=>x.id===p.renter_id)!);
  const again=applyAction(rejected,{type:'payment.submit',bill_id:p.bill_id,method:'gcash',received_on:s.today,reference:'NEW123',proof_path:'proofs/receipt.png',note:''});
  assert.equal(again.payments.at(-1)?.status,'pending');
});

test('owner onboarding validates capacity and amount and freezes generated rent',()=>{
  const s=makeState();
  const a={type:'renter.create' as const,username:'new.renter',full_name:'New Renter',phone:'',room_id:'room-102',monthly_rent:550000,due_day:Number(s.today.slice(8)),start_date:s.today,first_bill_month:s.today.slice(0,7),advance_received:true,deposit_received:true};
  for(const monthly_rent of [0,-1,1.5,Number.MAX_SAFE_INTEGER]) assert.throws(()=>applyAction(s,{...a,monthly_rent}));
  const created=applyAction(s,a), renter=created.profiles.find(p=>p.username===a.username)!,t=created.tenancies.find(t=>t.renter_id===renter.id)!;
  assert.equal(renter.must_change_password,true);assert.equal(t.deposit_held,550000);assert.equal(created.bills.filter(b=>b.renter_id===renter.id).length,1);
  assert.throws(()=>applyAction(created,{...a,username:'another'}));
  assert.throws(()=>applyAction(created,{type:'fund.record',tenancy_id:t.id,kind:'deposit_received',amount:550000,note:''}));
  const edited=applyAction(created,{type:'renter.update',id:renter.id,full_name:renter.full_name,phone:'',monthly_rent:600000,due_day:20,room_id:t.room_id});
  assert.equal(edited.bills.find(b=>b.renter_id===renter.id)?.amount,550000);
});

test('cross-renter proofs, future dates, duplicate approvals and partial proofs are rejected',()=>{
  const s=makeState();const p=s.payments.find(p=>p.status==='pending')!;
  const approved=applyAction(s,{type:'payment.review',id:p.id,approve:true,reason:''});
  assert.throws(()=>applyAction(approved,{type:'payment.review',id:p.id,approve:true,reason:''}));
  const partial=structuredClone(s);partial.payments.find(x=>x.id===p.id)!.amount--;
  assert.throws(()=>applyAction(partial,{type:'payment.review',id:p.id,approve:true,reason:''}));
  const rejected=applyAction(s,{type:'payment.review',id:p.id,approve:false,reason:'Bad proof'});
  rejected.viewer=structuredClone(rejected.profiles.find(p=>p.id==='sofia')!);
  assert.throws(()=>applyAction(rejected,{type:'payment.submit',bill_id:p.bill_id,method:'bank',received_on:s.today,reference:'ABC',proof_path:'proofs/receipt.png',note:''}));
  const b=s.bills.find(b=>b.status==='unpaid'&&b.renter_id==='sofia')!;
  assert.throws(()=>applyAction(s,{type:'payment.record',bill_id:b.id,method:'cash',received_on:'2099-12-31',reference:'',note:''}));
});

test('move-out applies only a full final bill, refunds remaining funds and stops actions',()=>{
  const s=makeState(); const t=s.tenancies.find(t=>t.renter_id==='sofia')!,b=s.bills.filter(b=>b.tenancy_id===t.id&&b.status==='unpaid').sort((a,b)=>a.period.localeCompare(b.period)).at(-1)!;
  const a={type:'tenancy.end' as const,id:t.id,end_date:s.today,final_bill_id:b.id,apply_deposit:true,refund_advance:true,refund_deposit:true};
  const short=structuredClone(s);short.tenancies.find(x=>x.id===t.id)!.deposit_held=b.amount-1;assert.throws(()=>applyAction(short,a));
  const ended=applyAction(s,a),after=ended.tenancies.find(x=>x.id===t.id)!;
  assert.equal(after.status,'ended');assert.equal(after.deposit_held,0);assert.equal(after.advance_held,0);assert.equal(ended.bills.find(x=>x.id===b.id)?.status,'paid');
  assert.equal(ended.fund_events.filter(e=>e.tenancy_id===t.id&&e.kind==='deposit_applied').length,1);
  ended.viewer=structuredClone(ended.profiles.find(p=>p.id===t.renter_id)!);
  const other=ended.bills.find(x=>x.tenancy_id===t.id&&x.status==='unpaid')!;
  assert.throws(()=>applyAction(ended,{type:'payment.submit',bill_id:other.id,method:'bank',received_on:s.today,reference:'ABC',proof_path:'proofs/receipt.png',note:''}));
});

test('owner may refund held funds after move-out but cannot receive more',()=>{
  const s=makeState(),t=s.tenancies.find(t=>t.renter_id==='sofia')!;
  const ended=applyAction(s,{type:'tenancy.end',id:t.id,end_date:s.today,final_bill_id:null,apply_deposit:false,refund_advance:false,refund_deposit:false});
  const refunded=applyAction(ended,{type:'fund.record',tenancy_id:t.id,kind:'deposit_refunded',amount:t.deposit_held,note:'Returned after inspection'});
  assert.equal(refunded.tenancies.find(x=>x.id===t.id)?.deposit_held,0);
  assert.throws(()=>applyAction(ended,{type:'fund.record',tenancy_id:t.id,kind:'deposit_received',amount:t.monthly_rent,note:''}));
});

test('billing defaults to current Manila day rather than persisted day',()=>{
  const s=makeState();s.today='2000-01-01';assert.equal(generateBills(s).today,manilaToday());
});

test('proof uploads must be stored files, never pasted data',()=>{
  const s=makeState('renter'),b=s.bills.find(b=>b.renter_id===s.viewer.id&&b.status==='unpaid')!;
  const action={type:'payment.submit' as const,bill_id:b.id,method:'gcash' as const,received_on:s.today,reference:'PROOF',proof_path:'proofs/receipt.png',note:''};
  assert.equal(applyAction(s,action).payments.at(-1)?.proof_path,action.proof_path);
  assert.throws(()=>applyAction(s,{...action,proof_path:'data:image/png;base64,'+'A'.repeat(2048)}));
  assert.throws(()=>applyAction(s,{...action,proof_path:''}));
  const owner=makeState(),t=owner.tenancies[0];
  assert.throws(()=>applyAction(owner,{type:'renter.update',id:t.renter_id,full_name:'Example',phone:'',monthly_rent:100000001,due_day:5,room_id:t.room_id}));
});

test('owner can collect and reverse arrears after move-out while renter remains read-only',()=>{
  const s=makeState(),t=s.tenancies.find(t=>t.renter_id==='sofia')!,bill=s.bills.find(b=>b.tenancy_id===t.id&&b.status==='unpaid')!;
  const ended=applyAction(s,{type:'tenancy.end',id:t.id,end_date:s.today,final_bill_id:null,apply_deposit:false,refund_advance:false,refund_deposit:false});
  const paid=applyAction(ended,{type:'payment.record',bill_id:bill.id,method:'cash',received_on:s.today,reference:'',note:'Arrears collected after departure'});
  assert.equal(paid.bills.find(b=>b.id===bill.id)?.status,'paid');
  const reversed=applyAction(paid,{type:'payment.reverse',id:paid.payments.at(-1)!.id,reason:'Wrong receipt'});
  assert.equal(reversed.bills.find(b=>b.id===bill.id)?.status,'unpaid');
});

test('move-out restricts deposit to latest eligible bill and voids future unpaid bills only',()=>{
  const s=makeState(),t=s.tenancies.find(t=>t.renter_id==='sofia')!,eligible=s.bills.filter(b=>b.tenancy_id===t.id).sort((a,b)=>a.period.localeCompare(b.period));
  const latest=eligible.at(-1)!,older=eligible[0];
  const future={...latest,id:'future-bill',period:'2099-01',due_date:'2099-01-05'};s.bills.push(future);
  const a={type:'tenancy.end' as const,id:t.id,end_date:s.today,final_bill_id:older.id,apply_deposit:true,refund_advance:false,refund_deposit:false};
  assert.throws(()=>applyAction(s,a));assert.throws(()=>applyAction(s,{...a,final_bill_id:future.id}));
  const ended=applyAction(s,{...a,final_bill_id:latest.id});
  assert.equal(ended.bills.find(b=>b.id===future.id)?.status,'void');assert.equal(ended.bills.find(b=>b.id===older.id)?.status,'unpaid');assert.equal(ended.bills.find(b=>b.id===latest.id)?.status,'paid');
});


test('reversing a future bill after move-out voids it instead of reopening debt',()=>{
  const s=makeState(),t=s.tenancies.find(t=>t.renter_id==='sofia')!,source=s.bills.find(b=>b.tenancy_id===t.id)!;
  const bill={...source,id:'future-paid-bill',period:'2099-01',due_date:'2099-01-05'};s.bills.push(bill);
  const paid=applyAction(s,{type:'payment.record',bill_id:bill.id,method:'cash',received_on:s.today,reference:'',note:''});const paymentId=paid.payments.at(-1)!.id;
  const ended=applyAction(paid,{type:'tenancy.end',id:t.id,end_date:s.today,final_bill_id:null,apply_deposit:false,refund_advance:false,refund_deposit:false});
  const reversed=applyAction(ended,{type:'payment.reverse',id:paymentId,reason:'Refunded payment beyond departure'});
  assert.equal(reversed.bills.find(b=>b.id===bill.id)?.status,'void');assert.equal(reversed.payments.at(-1)?.status,'reversed');
});

test('username must begin with a letter or number',()=>{
  const s=makeState();
  for(const username of ['.sofia','_sofia','-sofia']) assert.throws(()=>applyAction(s,{type:'renter.create',username,full_name:'Example',phone:'',room_id:'room-102',monthly_rent:500000,due_day:5,start_date:s.today,first_bill_month:s.today.slice(0,7),advance_received:false,deposit_received:false}));
});
