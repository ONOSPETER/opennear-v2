import {health} from '../server/chain.js';
const r=await health();for(const c of r)console.log(c.ok?'OK  ':'FAIL',c.name.padEnd(24),c.detail);process.exit(r.every(c=>c.ok)?0:1);
