import { randomUUID } from 'node:crypto';
import { actor, checked, owner, route } from '@/lib/server/context';
import { ApiError, assertOrigin, imageType } from '@/lib/server/validation';
import { applyAction } from '@/lib/server/actions';
export async function POST(request:Request) { return route(async()=>{
 assertOrigin(request);
 if(Number(request.headers.get('content-length'))>4*1024*1024+65536) throw new ApiError(413,'Image must be under 4 MB.');
 const {db,profile}=await actor(); const form=await request.formData(); const kind=form.get('kind');
 if(kind!=='qr' && kind!=='proof') throw new ApiError(400,'Invalid upload kind.');
 if(kind==='qr') owner(profile);
 const file=form.get('file'); if(!(file instanceof File)) throw new ApiError(400,'Select an image.');
 if(file.size>4*1024*1024) throw new ApiError(413,'Image must be under 4 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer()); const mime=imageType(bytes);
 const path=`${profile.id}/${randomUUID()}.${mime.split('/')[1]}`;
 checked((await db.storage.from('rentmate-private').upload(path,bytes,{contentType:mime,upsert:false})).error);
 try {
  if(kind==='qr') { checked((await db.from('settings').update({gcash_qr_path:path}).eq('id',true)).error); return {ok:true}; }
  return await applyAction({type:'payment.submit',bill_id:form.get('bill_id'),method:form.get('method'),received_on:form.get('received_on'),reference:form.get('reference')||'',note:form.get('note')||'',proof_path:path},true);
 } catch(error) {await db.storage.from('rentmate-private').remove([path]); throw error;}
 }); }
