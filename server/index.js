import express from 'express';import fs from 'fs';import path from 'path';import crypto from 'crypto';
import {C} from './config.js';import {inventory,tokenOwner,verifyDeposit} from './near.js';import {mintOnBase,redeemedTo,returnToNear,health,minterAddress} from './chain.js';
const app=express();app.use(express.json({limit:'50kb'}));
const F='data.json';let db={orders:[]};try{db=JSON.parse(fs.readFileSync(F))}catch{}
const save=()=>fs.writeFileSync(F,JSON.stringify(db,null,1));
const fail=(status,message)=>Object.assign(new Error(message),{status});
const wrap=f=>(q,s)=>f(q,s).catch(e=>{console.error(e);s.status(e.status||500).json({error:e.message||'Unexpected error'})});
const NEAR_ID=/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const find=id=>{const o=db.orders.find(x=>x.id===id);if(!o)throw fail(404,'Order not found.');return o};
const locks=new Set();
async function exclusive(id,fn){if(locks.has(id))throw fail(429,'This order is already being processed.');locks.add(id);try{return await fn()}finally{locks.delete(id)}}
const view=o=>({...o,demo:C.demo,opensea:o.evmId?`${C.opensea}/${C.wrapper}/${o.evmId}`:undefined,txUrl:o.txHash?`${C.scan}/tx/${o.txHash}`:undefined});
async function release(o){
 if(o.status!=='minted')return o;
 const target=C.demo?o.owner:await redeemedTo(o.evmId);if(!target)return null;
 if(target.length>64||!NEAR_ID.test(target)){o.status='stuck';o.error='Invalid NEAR account in burn: '+target;save();return o}
 o.status='returning';save();
 try{o.returnTx=C.demo?'demo':await returnToNear(o,target);o.returnedTo=target;o.status='redeemed';o.error=null}
 catch(e){console.error(e);o.error=e.message;o.tries=(o.tries||0)+1;o.status=o.tries>=5?'stuck':'minted'}
 save();return o}
app.get('/api/config',wrap(async(q,s)=>{let minter=null;if(!C.demo)minter=await minterAddress().catch(()=>null);
 s.json({network:C.network,demo:C.demo,missing:C.missing,vault:C.vault||'(not set)',wrapper:C.wrapper,minter,chainLabel:C.chainLabel,chainIdHex:'0x'+C.chain.id.toString(16)})}));
app.get('/api/health',wrap(async(q,s)=>s.json(await health())));
app.get('/api/nfts/:acc',wrap(async(q,s)=>s.json(await inventory(q.params.acc,q.query.contract))));
app.get('/api/orders',(q,s)=>s.json(q.query.owner?db.orders.filter(o=>o.owner===q.query.owner).reverse().map(view):[]));
app.post('/api/orders',wrap(async(q,s)=>{const{owner,contract,tokenId,evmTo,title,media}=q.body||{};
 if(!/^0x[0-9a-fA-F]{40}$/.test(evmTo||''))throw fail(400,'Enter a valid Base (EVM) address.');
 if(![owner,contract].every(x=>typeof x==='string'&&NEAR_ID.test(x)&&x.length<=64)||typeof tokenId!=='string'||!tokenId||tokenId.length>128)throw fail(400,'Missing or invalid NFT details.');
 if(!C.demo&&await tokenOwner(contract,tokenId)!==owner)throw fail(403,'You do not own this NFT.');
 const dup=db.orders.find(o=>o.owner===owner&&o.contract===contract&&o.tokenId===tokenId&&!['redeemed','stuck'].includes(o.status));
 if(dup&&dup.status!=='created')throw fail(409,'This NFT already has an active bridge order.');
 const o=dup||{id:crypto.randomUUID().slice(0,8),owner,contract,tokenId,status:'created',created:Date.now()};
 Object.assign(o,{evmTo,title:String(title||'').slice(0,100),media:typeof media==='string'?media.slice(0,500):null});if(!dup)db.orders.push(o);save();
 s.json({...view(o),vault:C.vault})}));
app.post('/api/orders/:id/confirm',wrap(async(q,s)=>{const o=find(q.params.id);if(o.status==='minted')return s.json(view(o));
 await exclusive(o.id,async()=>{if(!['created','failed'].includes(o.status))return;
  if(!C.demo){const tx=q.body?.txHash||o.depositTx;if(!tx)throw fail(400,'Missing the NEAR transaction hash. Retry the transfer from your wallet.');
   if(db.orders.some(x=>x.id!==o.id&&x.depositTx===tx))throw fail(409,'That transaction was already used.');
   o.depositTx=tx;save();await verifyDeposit(o,tx);
   if(await tokenOwner(o.contract,o.tokenId)!==C.vault)throw fail(409,'The NFT has not reached the vault yet. Try again in a few seconds.')}
  o.status='minting';o.error=null;save();
  try{Object.assign(o,await mintOnBase(o),{status:'minted'})}catch(e){console.error(e);o.status='failed';o.error=e.message}
  save()});
 s.json(view(o))}));
app.post('/api/orders/:id/redeem',wrap(async(q,s)=>{const o=find(q.params.id);if(o.status==='redeemed')return s.json(view(o));
 if(o.status!=='minted')throw fail(409,'This order is not bridged yet.');
 const r=await exclusive(o.id,()=>release(o));if(!r)throw fail(409,'Burn the wrapped NFT on Base first (redeem on the wrapper), then try again.');s.json(view(o))}));
if(!C.demo)setInterval(async()=>{for(const o of db.orders.filter(x=>x.status==='minted'))try{await exclusive(o.id,()=>release(o))}catch{}},30000);
app.use(express.static('dist'));app.get('*',(q,s)=>s.sendFile(path.resolve('dist/index.html')));
app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log(`OpenNear up on ${C.network}`,C.demo?`(DEMO mode, missing: ${C.missing.join(', ')||'DEMO=true'})`:'(LIVE)'));
