/** Fetch every row despite the Data API's default 1,000-row response cap. */
export async function allPages<T>(fetchPage:(from:number,to:number)=>Promise<T[]>):Promise<T[]> {
 const rows:T[]=[];
 for(let offset=0;;offset+=1000) {
  const batch=await fetchPage(offset,offset+999);rows.push(...batch);
  if(batch.length<1000) return rows;
 }
}
