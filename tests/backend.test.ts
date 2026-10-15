import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { actionSchema, assertOrigin, imageType, internalEmail, password } from '../lib/server/validation';
test('usernames are normalized; internal email and strong password validation',()=>{
 assert.equal(internalEmail(' Ana_12 '),'ana_12@accounts.rentmate.invalid');
 assert.throws(()=>internalEmail('x@y.com')); assert.throws(()=>password.parse('short')); assert.equal(password.parse('correct horse 123'),'correct horse 123');
});
test('mutation origin validation denies missing and cross-site origins',()=>{
 const old=process.env.APP_ORIGIN;process.env.APP_ORIGIN='https://rentmate.test';
 try {assert.throws(()=>assertOrigin(new Request('https://rentmate.test/api/actions')));assert.throws(()=>assertOrigin(new Request('https://rentmate.test/api/actions',{headers:{origin:'https://evil.test'}})));assertOrigin(new Request('https://rentmate.test/api/actions',{headers:{origin:'https://rentmate.test'}}));} finally {if(old===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=old;}
});
test('uploads inspect image signatures and cap bytes',()=>{
 assert.equal(imageType(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])),'image/png');assert.throws(()=>imageType(new TextEncoder().encode('<svg onload="x">')));assert.throws(()=>imageType(new Uint8Array(4194305)));
});
test('actions reject partial fractional money and missing rejection reasons',()=>{
 assert.throws(()=>actionSchema.parse({type:'fund.record',tenancy_id:crypto.randomUUID(),kind:'advance_received',amount:0.5,note:''}));
 assert.throws(()=>actionSchema.parse({type:'payment.review',id:crypto.randomUUID(),approve:false,reason:''}));
});

test('state pagination retrieves records beyond the default API cap and propagates failures',async()=>{
 const {allPages}=await import('../lib/server/pagination');
 const source=Array.from({length:2001},(_,id)=>({id}));
 assert.deepEqual(await allPages(async(from,to)=>source.slice(from,to+1)),source);
 await assert.rejects(allPages(async()=>{throw new Error('Database unavailable');}));
});
