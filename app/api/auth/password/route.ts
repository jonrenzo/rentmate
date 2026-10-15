import { z } from 'zod';
import { actor, checked, route } from '@/lib/server/context';
import { assertOrigin, password } from '@/lib/server/validation';
export async function POST(request:Request) { return route(async()=>{
 assertOrigin(request); const input=z.object({password}).parse(await request.json());
 const {client,db,profile,authValidAfter}=await actor(true);
 checked((await client.auth.updateUser({password:input.password})).error);
 checked((await db.from('profiles').update({must_change_password:false}).eq('id',profile.id).eq('auth_valid_after',authValidAfter).select('id').single()).error);
 return {ok:true};
 }); }
