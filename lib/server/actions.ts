import 'server-only';
import { randomBytes } from 'node:crypto';
import { actor, checked, owner } from './context';
import { actionSchema, ApiError, internalEmail } from './validation';
export async function applyAction(input:unknown, uploaded=false) {
 const a=actionSchema.parse(input); const {db,profile}=await actor();
 if(a.type==='payment.submit' && !uploaded) throw new ApiError(400,'Submit proof through the image upload form.');
 if(a.type!=='payment.submit') owner(profile);
 if(a.type==='renter.create') {
  const temporary_password=randomBytes(18).toString('base64url');
  const {data,error}=await db.auth.admin.createUser({email:internalEmail(a.username),password:temporary_password,email_confirm:true});
  checked(error); if(!data.user) throw new ApiError(409,'Account creation failed.');
  const {error:failure}=await db.rpc('apply_action',{actor:profile.id,a:{...a,first_bill_month:a.first_bill_month+'-01',renter_id:data.user.id}});
  if(failure) { await db.auth.admin.deleteUser(data.user.id); checked(failure); }
  return {ok:true,temporary_password};
 }
 if(a.type==='password.reset') {
  const {data:target,error}=await db.from('profiles').select('id').eq('id',a.renter_id).eq('role','renter').single();
  checked(error); if(!target) throw new ApiError(404,'Renter not found.');
  // Gate before changing credentials so failed resets remain locked safely.
  checked((await db.from('profiles').update({must_change_password:true,auth_valid_after:new Date().toISOString()}).eq('id',target.id)).error);
  const temporary_password=randomBytes(18).toString('base64url');
  checked((await db.auth.admin.updateUserById(target.id,{password:temporary_password})).error);
  return {ok:true,temporary_password};
 }
 checked((await db.rpc('apply_action',{actor:profile.id,a})).error);
 return {ok:true};
}
