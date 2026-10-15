import { z } from 'zod';
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export const username = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,31}$/);
export const password = z.string().min(12).max(128);
const id = z.string().uuid(), text = z.string().trim().max(2000), name = z.string().trim().min(1).max(100);
const money = z.number().int().positive().max(100000000), day = z.number().int().min(1).max(31);
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v);
const month = z.string().regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/);
const payment = { bill_id:id, method:z.enum(['cash','gcash','bank']), received_on:date, reference:text, note:text };
export const actionSchema = z.discriminatedUnion('type', [
 z.object({type:z.literal('room.save'),id:id.optional(),name,capacity:z.number().int().min(1).max(100),notes:text}),
 z.object({type:z.literal('renter.create'),username,full_name:name,phone:z.string().max(40),room_id:id,monthly_rent:money,due_day:day,start_date:date,first_bill_month:month,advance_received:z.boolean(),deposit_received:z.boolean()}).refine(a => a.first_bill_month >= a.start_date.slice(0,7)),
 z.object({type:z.literal('renter.update'),id,full_name:name,phone:z.string().max(40),monthly_rent:money,due_day:day,room_id:id}),
 z.object({type:z.literal('password.reset'),renter_id:id}),
 z.object({type:z.literal('payment.record'),...payment}),
 z.object({type:z.literal('payment.submit'),...payment,method:z.enum(['gcash','bank']),proof_path:z.string().min(1).max(200)}),
 z.object({type:z.literal('payment.review'),id,approve:z.boolean(),reason:text}).refine(a=>a.approve || a.reason.length>0),
 z.object({type:z.literal('payment.reverse'),id,reason:name}),
 z.object({type:z.literal('fund.record'),tenancy_id:id,kind:z.enum(['advance_received','deposit_received','advance_refunded','deposit_refunded']),amount:money,note:text}),
 z.object({type:z.literal('tenancy.end'),id,end_date:date,final_bill_id:id.nullable(),apply_deposit:z.boolean(),refund_advance:z.boolean(),refund_deposit:z.boolean()}),
 z.object({type:z.literal('settings.save'),property_name:name,gcash_name:text,gcash_number:z.string().max(40),bank_details:text}),
]);
export function assertOrigin(request: Request) {
 const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
 if (request.headers.get('origin') !== expected || request.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError(403,'Request origin not allowed.');
}
export function imageType(bytes: Uint8Array): string {
 if (bytes.length > 4*1024*1024 || bytes.length < 12) throw new ApiError(400,'Image must be under 4 MB.');
 if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
 if ([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return 'image/png';
 if (Buffer.from(bytes.slice(0,4)).toString()==='RIFF' && Buffer.from(bytes.slice(8,12)).toString()==='WEBP') return 'image/webp';
 throw new ApiError(400,'Use a JPEG, PNG or WebP image.');
}
export const internalEmail = (value:string) => `${username.parse(value)}@accounts.rentmate.invalid`;
