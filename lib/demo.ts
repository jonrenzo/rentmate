import type { AppState, Profile, Role } from './types';
import { generateBills, manilaToday } from './domain';
import { randomId } from './id';

export function createDemoState(role: Role = 'owner'): AppState {
  const today=manilaToday(), current=today.slice(0,7), previousDate=new Date(`${current}-01T00:00:00Z`);
  previousDate.setUTCMonth(previousDate.getUTCMonth()-1); const previous=previousDate.toISOString().slice(0,7);
  const profiles:Profile[]=[
    {id:'owner-demo',username:'owner',full_name:'Alex Reyes',phone:'',role:'owner',must_change_password:false},
    {id:'sofia-demo',username:'sofia',full_name:'Sofia Garcia',phone:'0917 000 0101',role:'renter',must_change_password:false},
    {id:'miguel-demo',username:'miguel',full_name:'Miguel Santos',phone:'0917 000 0102',role:'renter',must_change_password:false},
    {id:'isabel-demo',username:'isabel',full_name:'Isabel Cruz',phone:'0917 000 0103',role:'renter',must_change_password:false},
  ];
  let state:AppState={viewer:{...profiles[role==='owner'?0:1]},profiles,rooms:[
    {id:'room-101',name:'Room 101',capacity:2,notes:'Ground floor · courtyard side'},
    {id:'room-102',name:'Room 102',capacity:1,notes:'Ground floor'},
    {id:'room-201',name:'Room 201',capacity:2,notes:'Second floor · balcony'},
  ],tenancies:profiles.slice(1).map((p,i)=>({id:`tenancy-${p.id}`,renter_id:p.id,room_id:i===2?'room-201':'room-101',monthly_rent:i===2?750000:650000,due_day:Math.min(Number(today.slice(8)),i===0?5:i===1?10:15),start_date:`${previous}-01`,first_bill_month:previous,end_date:null,status:'active',advance_held:i===2?750000:650000,deposit_held:i===2?750000:650000})),bills:[],payments:[],fund_events:[],settings:{property_name:'The Courtyard',gcash_name:'Alex Reyes · Demo only',gcash_number:'0917 000 0000',gcash_qr_path:null,bank_details:'Demo only — no real payment account. Use your own instructions after setup.'},today,demo:true};
  state=generateBills(state,today);
  for(const t of state.tenancies) for(const kind of ['advance_received','deposit_received'] as const) state.fund_events.push({id:randomId(),tenancy_id:t.id,kind,amount:t.monthly_rent,date:t.start_date,note:'Synthetic demo move-in receipt'});
  for(const bill of state.bills) {
    const isPaid=bill.period===previous&&bill.renter_id!=='sofia-demo'||bill.period===current&&bill.renter_id==='isabel-demo';
    const pending=bill.period===current&&bill.renter_id==='miguel-demo';
    if(!isPaid&&!pending)continue;
    const timestamp=`${today}T02:00:00.000Z`;
    if(isPaid){bill.status='paid';bill.paid_at=timestamp;}
    state.payments.push({id:randomId(),bill_id:bill.id,renter_id:bill.renter_id,amount:bill.amount,method:pending?'gcash':'cash',status:pending?'pending':'approved',reference:pending?'DEMO-482019':'',proof_path:pending?'/demo-proof.svg':null,received_on:today,submitted_at:timestamp,reviewed_at:pending?null:timestamp,note:'Synthetic demo payment'});
  }
  return state;
}

