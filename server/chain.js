import {createPublicClient,http,keccak256,toHex,getAddress,encodeFunctionData,parseAbi,parseEther,serializeTransaction,recoverAddress} from 'viem';
import {connect,KeyPair,keyStores,providers} from 'near-api-js';
import {C} from './config.js';import {view,rpc,tokenMeta} from './near.js';
const PATH='base-1',N=0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const abi=parseAbi(['function mint(address to,uint256 id,string uri)','function minter() view returns (address)','function redeemedTo(uint256) view returns (string)']);
const pub=createPublicClient({chain:C.chain,transport:http(C.baseRpc)});
export const evmId=o=>BigInt(keccak256(toHex(`${o.contract}:${o.tokenId}`))).toString();
const AL='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58hex=s=>{let n=0n;for(const ch of s)n=n*58n+BigInt(AL.indexOf(ch));return n.toString(16).padStart(128,'0')};
let acct,minter;
async function account(){if(acct)return acct;const ks=new keyStores.InMemoryKeyStore();await ks.setKey(C.network,C.vault,KeyPair.fromString(C.key));
 const n=await connect({networkId:C.network,keyStore:ks,nodeUrl:C.nearRpc[0]});return acct=await n.account(C.vault)}
export async function minterAddress(){if(minter)return minter;
 let r;try{r=await view(C.signer,'derived_public_key',{path:PATH,predecessor:C.vault,domain_id:0})}catch{r=await view(C.signer,'derived_public_key',{path:PATH,predecessor:C.vault})}
 return minter=getAddress('0x'+keccak256('0x'+b58hex(String(r).replace(/^secp256k1:/,''))).slice(-40))}
async function mpcSign(hash){const a=await account(),call=args=>a.functionCall({contractId:C.signer,methodName:'sign',args:{request:args},gas:300000000000000n,attachedDeposit:1n});
 let out;try{out=await call({payload_v2:{Ecdsa:hash.slice(2)},path:PATH,domain_id:0})}
 catch{out=await call({payload:[...Buffer.from(hash.slice(2),'hex')],path:PATH,key_version:0})}
 const r=providers.getTransactionLastResult(out);if(!r?.big_r)throw new Error('Unexpected Chain Signatures response: '+JSON.stringify(r).slice(0,200));
 let s=BigInt('0x'+r.s.scalar);if(s>N/2n)s=N-s;
 return{r:'0x'+r.big_r.affine_point.slice(2),s:'0x'+s.toString(16).padStart(64,'0')}}
let q=Promise.resolve();const serial=f=>{const run=q.then(f);q=run.catch(()=>{});return run};
export const mintOnBase=o=>serial(async()=>{
 const id=evmId(o);if(C.demo)return{evmId:id,txHash:'0xdemo'+Date.now().toString(16)};
 const from=await minterAddress();
 if(await pub.getBalance({address:from})<parseEther('0.0003'))throw new Error(`Minter ${from} has no ETH on ${C.chainLabel}. Send ~0.002 ETH to it.`);
 const m=await tokenMeta(o.contract,o.tokenId).catch(()=>({name:o.title,image:o.media,description:''}));
 const uri='data:application/json;base64,'+Buffer.from(JSON.stringify({name:m.name||o.title,description:m.description||'',image:m.image||o.media||'',attributes:[{trait_type:'Origin',value:`NEAR ${o.contract}`},{trait_type:'NEAR token id',value:o.tokenId}]})).toString('base64');
 const data=encodeFunctionData({abi,functionName:'mint',args:[o.evmTo,BigInt(id),uri]});
 const [nonce,fees,gas]=await Promise.all([pub.getTransactionCount({address:from,blockTag:'pending'}),pub.estimateFeesPerGas(),pub.estimateGas({account:from,to:C.wrapper,data})]);
 const tx={type:'eip1559',chainId:C.chain.id,nonce,to:C.wrapper,data,value:0n,gas:gas*13n/10n,maxFeePerGas:fees.maxFeePerGas,maxPriorityFeePerGas:fees.maxPriorityFeePerGas};
 const hash=keccak256(serializeTransaction(tx)),{r,s}=await mpcSign(hash);let sig;
 for(const yParity of [0,1])if((await recoverAddress({hash,signature:{r,s,yParity}}).catch(()=>''))===from){sig={r,s,yParity};break}
 if(!sig)throw new Error('MPC signature does not match the derived minter address.');
 const txHash=await pub.sendRawTransaction({serializedTransaction:serializeTransaction(tx,sig)});
 const rc=await pub.waitForTransactionReceipt({hash:txHash,timeout:90000});if(rc.status!=='success')throw new Error('Mint reverted on Base: '+txHash);
 return{evmId:id,txHash}});
export async function redeemedTo(id){try{return(await pub.readContract({address:C.wrapper,abi,functionName:'redeemedTo',args:[BigInt(id)]}))||null}catch{return null}}
export async function returnToNear(o,target){const a=await account();
 const out=await a.functionCall({contractId:o.contract,methodName:'nft_transfer',args:{receiver_id:target,token_id:o.tokenId,memo:'opennear-return:'+o.id},gas:30000000000000n,attachedDeposit:1n});
 return out.transaction_outcome?.id||out.transaction?.hash||''}
export async function health(){const out=[],add=(name,ok,detail)=>out.push({name,ok,detail});
 add('Mode',!C.demo,C.demo?'DEMO. Missing: '+C.missing.join(', '):`${C.network}: NEAR + ${C.chainLabel}`);if(C.demo)return out;
 try{const pk=KeyPair.fromString(C.key).getPublicKey().toString(),j=await rpc('query',{request_type:'view_access_key',finality:'final',account_id:C.vault,public_key:pk});
  add('Vault key',!j.error,j.error?`Key is not on ${C.vault}`:'ok');
  const acc=await rpc('query',{request_type:'view_account',finality:'final',account_id:C.vault}),near=Number(BigInt(acc.result?.amount||0)/10n**21n)/1000;add('Vault NEAR',near>=0.5,near+' NEAR (needs ~1)')}catch(e){add('Vault key',false,e.message)}
 let m;try{m=await minterAddress();add('MPC derived minter',true,m)}catch(e){add('MPC derived minter',false,e.message)}
 if(m){try{const b=await pub.getBalance({address:m});add('Minter ETH',b>=parseEther('0.0005'),(Number(b)/1e18).toFixed(5)+' ETH on '+C.chainLabel)}catch(e){add('Minter ETH',false,e.message)}
  try{const code=await pub.getCode({address:C.wrapper});add('Wrapper deployed',!!code&&code!=='0x',C.wrapper);
   const w=await pub.readContract({address:C.wrapper,abi,functionName:'minter'});add('Wrapper minter matches',w===m,w===m?'ok':`wrapper minter ${w} != ${m}`)}catch(e){add('Wrapper',false,e.message)}}
 return out}
