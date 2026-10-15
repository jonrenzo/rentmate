import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
const {values}=parseArgs({options:{username:{type:'string'},name:{type:'string'},recover:{type:'boolean',default:false}}});
const username=values.username?.trim().toLowerCase();
if(!username || !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) throw new Error('Usage: npm run bootstrap-owner -- --username owner --name "Your name" [--recover]');
const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url || !secret) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const fail=(error)=>{if(error) throw new Error('Owner setup failed. Check configuration and database state.');};
const {data:existing,error}=await db.from('profiles').select('id,username').eq('role','owner').maybeSingle();fail(error);
const password=randomBytes(18).toString('base64url');
if(values.recover) {
 if(!existing || existing.username!==username) throw new Error('Recovery username does not match the existing owner.');
 fail((await db.from('profiles').update({must_change_password:true,auth_valid_after:new Date().toISOString()}).eq('id',existing.id)).error);
 fail((await db.auth.admin.updateUserById(existing.id,{password})).error);
} else {
 if(existing) throw new Error('An owner exists. Use --recover to replace their password.');
 const {data,error:createError}=await db.auth.admin.createUser({email:`${username}@accounts.rentmate.invalid`,password,email_confirm:true});fail(createError);
 if(!data.user) throw new Error('Owner creation failed.');
 const {error:profileError}=await db.from('profiles').insert({id:data.user.id,username,full_name:values.name||username,phone:'',role:'owner',must_change_password:true});
 if(profileError) {await db.auth.admin.deleteUser(data.user.id);fail(profileError);}
}
console.log(`Owner: ${username}\nOne-time temporary password: ${password}\nSign in and replace it immediately. Do not save this output in logs.`);
