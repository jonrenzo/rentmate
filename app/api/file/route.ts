import { actor, checked, route } from '@/lib/server/context';
import { ApiError } from '@/lib/server/validation';
export const dynamic='force-dynamic';
export async function GET(request:Request) {return route(async()=>{
 const {client,db}=await actor(); const path=new URL(request.url).searchParams.get('path');
 if(!path || path.length>200) throw new ApiError(400,'Invalid image path.');
 const [{data:payment},{data:setting}]=await Promise.all([client.from('payments').select('id').eq('proof_path',path).limit(1),client.from('settings').select('id').eq('gcash_qr_path',path).limit(1)]);
 if(!payment?.length && !setting?.length) throw new ApiError(404,'Image not found.');
 const {data,error}=await db.storage.from('rentmate-private').createSignedUrl(path,60);checked(error);
 if(!data) throw new ApiError(404,'Image not found.');
 return new Response(null,{status:302,headers:{Location:data.signedUrl,'Referrer-Policy':'no-referrer'}});
 });}
