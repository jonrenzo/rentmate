export type Role = 'owner' | 'renter';
export type Profile = { id: string; username: string; full_name: string; phone: string; role: Role; must_change_password: boolean };
export type Room = { id: string; name: string; capacity: number; notes: string };
export type Tenancy = { id: string; renter_id: string; room_id: string; monthly_rent: number; due_day: number; start_date: string; first_bill_month: string; end_date: string | null; status: 'active' | 'ended'; advance_held: number; deposit_held: number };
export type Bill = { id: string; tenancy_id: string; renter_id: string; period: string; due_date: string; amount: number; status: 'unpaid' | 'paid' | 'void'; paid_at: string | null };
export type Payment = { id: string; bill_id: string; renter_id: string; amount: number; method: 'cash' | 'gcash' | 'bank' | 'deposit'; status: 'pending' | 'approved' | 'rejected' | 'reversed'; reference: string; proof_path: string | null; received_on: string; submitted_at: string; reviewed_at: string | null; note: string };
export type FundEvent = { id: string; tenancy_id: string; kind: 'advance_received' | 'deposit_received' | 'advance_refunded' | 'deposit_refunded' | 'deposit_applied'; amount: number; date: string; note: string };
export type Settings = { property_name: string; gcash_name: string; gcash_number: string; gcash_qr_path: string | null; bank_details: string };
export type AppState = { viewer: Profile; onboarding_required: boolean; profiles: Profile[]; rooms: Room[]; tenancies: Tenancy[]; bills: Bill[]; payments: Payment[]; fund_events: FundEvent[]; settings: Settings; today: string };
export type Action =
 | { type: 'room.save'; id?: string; name: string; capacity: number; notes: string }
 | { type: 'renter.create'; username: string; full_name: string; phone: string; room_id: string; monthly_rent: number; due_day: number; start_date: string; first_bill_month: string; advance_received: boolean; deposit_received: boolean }
 | { type: 'renter.update'; id: string; full_name: string; phone: string; monthly_rent: number; due_day: number; room_id: string }
 | { type: 'password.reset'; renter_id: string }
 | { type: 'payment.record'; bill_id: string; method: 'cash' | 'gcash' | 'bank'; received_on: string; reference: string; note: string }
 | { type: 'payment.submit'; bill_id: string; method: 'gcash' | 'bank'; received_on: string; reference: string; proof_path: string; note: string }
 | { type: 'payment.review'; id: string; approve: boolean; reason: string }
 | { type: 'payment.reverse'; id: string; reason: string }
 | { type: 'fund.record'; tenancy_id: string; kind: 'advance_received' | 'deposit_received' | 'advance_refunded' | 'deposit_refunded'; amount: number; note: string }
 | { type: 'tenancy.end'; id: string; end_date: string; final_bill_id: string | null; apply_deposit: boolean; refund_advance: boolean; refund_deposit: boolean }
 | { type: 'settings.save'; property_name: string; gcash_name: string; gcash_number: string; bank_details: string };
export type ActionResult = { ok: true; temporary_password?: string };
