import {C} from './config.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function rpc(method,params){let last;
 for(const url of C.nearRpc)for(let i=0;i<2;i++){try{
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'on',method,params}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}catch(e){last=e;await sleep(300)}}
 throw new Error('NEAR RPC unreachable: '+last?.message)}
export async function view(c,m,a={}){const j=await rpc('query',{request_type:'call_function',finality:'final',account_id:c,method_name:m,args_base64:Buffer.from(JSON.stringify(a)).toString('base64')});
 if(j.error||j.result?.error)throw new Error(j.result?.error||j.error?.data||'NEAR view failed');return JSON.parse(Buffer.from(j.result.result).toString())}
export const tokenOwner=async(c,id)=>(await view(c,'nft_token',{token_id:id}))?.owner_id;
const media=(base,m)=>!m?null:/^(https?:|data:)/.test(m)?m:(base||'https://ipfs.near.social/ipfs')+'/'+m;
export async function tokenMeta(c,id){const [t,meta]=await Promise.all([view(c,'nft_token',{token_id:id}),view(c,'nft_metadata').catch(()=>({}))]);const m=t?.metadata||{};
 return{name:m.title||`#${id}`,description:m.description||'',image:media(meta.base_uri,m.media)}}
export async function verifyDeposit(o,hash){
 const j=await rpc('tx',[hash,o.owner]);if(j.error||!j.result)throw new Error('NEAR transaction not found yet. Try again in a few seconds.');
 const {transaction:t,status}=j.result;
 if(t.signer_id!==o.owner)throw new Error('That transaction was signed by a different account.');
 if(t.receiver_id!==o.contract)throw new Error('Transaction was sent to a different NFT contract.');
 if(status?.Failure)throw new Error('The NFT transfer failed on NEAR.');
 const fc=t.actions.map(a=>a.FunctionCall).find(Boolean);if(fc?.method_name!=='nft_transfer')throw new Error('Not an nft_transfer transaction.');
 const a=JSON.parse(Buffer.from(fc.args,'base64').toString());
 if(a.receiver_id!==C.vault||a.token_id!==o.tokenId||a.memo!==o.id)throw new Error('Transaction does not match this order.')}
async function contracts(acc){try{const r=await fetch(`${C.nearblocks}/v1/account/${acc}/inventory`,{headers:process.env.NEARBLOCKS_KEY?{Authorization:'Bearer '+process.env.NEARBLOCKS_KEY}:{},signal:AbortSignal.timeout(12000)});
 return((await r.json()).inventory?.nfts||[]).map(n=>n.contract)}catch{return[]}}
export async function inventory(acc,extra){
 const cs=[...new Set([...(await contracts(acc)),...(extra?[extra]:[])])].slice(0,25);
 const out=await Promise.all(cs.map(async c=>{try{
  const meta=await view(c,'nft_metadata').catch(()=>({}));
  const t=await view(c,'nft_tokens_for_owner',{account_id:acc,from_index:'0',limit:50});
  return t.map(x=>{const m=x.metadata||{};return{contract:c,collection:meta.name||c,tokenId:x.token_id,title:m.title||`#${x.token_id}`,media:media(meta.base_uri,m.media),description:m.description||''}})}catch{return[]}}));
 return out.flat()}
