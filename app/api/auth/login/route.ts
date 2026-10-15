import { z } from 'zod';
import { actor, route, session } from '@/lib/server/context';
import { ApiError, assertOrigin, internalEmail, username } from '@/lib/server/validation';
export async function POST(request:Request) { return route(async()=>{
 assertOrigin(request); const input=z.object({username,password:z.string().min(1).max(128)}).parse(await request.json());
 const client=await session(); const {error}=await client.auth.signInWithPassword({email:internalEmail(input.username),password:input.password});
 if(error) throw new ApiError(401,'Incorrect username or password.');
 const {profile}=await actor(true); return {ok:true,must_change_password:profile.must_change_password};
 }); }
