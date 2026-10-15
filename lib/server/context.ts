import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { ZodError } from 'zod';
import { ApiError } from './validation';
import type { Profile } from '../types';
export function env() {
 const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_PUBLISHABLE_KEY, secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !key || !secret) throw new ApiError(503,'Live mode is not configured. Configure the Supabase environment variables.');
 return {url,key,secret};
}
export function admin() { const {url,secret}=env(); return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}); }
export async function session() {
 const jar=await cookies(), {url,key}=env();
 return createServerClient(url,key,{cookies:{getAll:()=>jar.getAll(),setAll: values=>{values.forEach(({name,value,options})=>jar.set(name,value,{...options,httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/'}));}}});
}
export async function actor(allowTemporary=false) {
 const client=await session(); const {data:{user},error}=await client.auth.getUser();
 if(error || !user) throw new ApiError(401,'Please sign in.');
 const db=admin(); const {data:profile,error:failure}=await db.from('profiles').select('*').eq('id',user.id).single();
 if(failure || !profile) throw new ApiError(403,'Account is not registered.');
 const {data:claims,error:claimsError}=await client.auth.getClaims();
 const sessionId=claims?.claims.session_id;
 if(claimsError || typeof sessionId!=='string') throw new ApiError(401,'Please sign in again.');
 const {data:allowed,error:sessionError}=await db.rpc('session_allowed',{actor:user.id,session:sessionId});
 if(sessionError || !allowed) throw new ApiError(401,'Your password was reset. Please sign in again.');
 const authValidAfter=profile.auth_valid_after as string;
 delete profile.auth_valid_after;
 if(profile.must_change_password && !allowTemporary) throw new ApiError(428,'Change your temporary password first.');
 return {client,db,profile:profile as Profile,authValidAfter};
}
export function owner(profile:Profile) { if(profile.role!=='owner') throw new ApiError(403,'Owner access required.'); }
export async function route(fn:()=>Promise<unknown>) {
 try { const result=await fn(); if(result instanceof Response) {result.headers.set('Cache-Control','no-store');return result;} return Response.json(result,{headers:{'Cache-Control':'no-store'}}); }
 catch(error) {const known=error instanceof ApiError; return Response.json({error:known?error.message:error instanceof ZodError || error instanceof SyntaxError?'Check the entered details.':'Request could not be completed. Please try again.'},{status:known?error.status:error instanceof ZodError || error instanceof SyntaxError?400:500,headers:{'Cache-Control':'no-store'}});}
}
export function checked(error:unknown) { if(error) throw new ApiError(409,'The change could not be saved. Check for pending payments, occupied rooms, or changed records, then refresh.'); }
