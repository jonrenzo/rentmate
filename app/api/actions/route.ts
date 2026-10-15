import { route } from '@/lib/server/context';
import { assertOrigin } from '@/lib/server/validation';
import { applyAction } from '@/lib/server/actions';
export async function POST(request:Request) { return route(async()=>{assertOrigin(request);return applyAction(await request.json());}); }
