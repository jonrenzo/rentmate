import { route, session } from '@/lib/server/context';
import { assertOrigin } from '@/lib/server/validation';
export async function POST(request:Request) { return route(async()=>{assertOrigin(request);const client=await session();await client.auth.signOut();return {ok:true};}); }
