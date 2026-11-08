const acc = process.argv[2];
if (!acc) { console.log('Usage: node scripts/why.js yourname.testnet'); process.exit(1); }
const list = await (await fetch(`https://api-testnet.nearblocks.io/v1/account/${acc}/txns?limit=5&method=nft_mint`)).json();
for (const t of list.txns || []) {
  const r = await (await fetch('https://test.rpc.fastnear.com', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tx', params: [t.transaction_hash, acc] }),
  })).json();
  const res = r.result;
  const fails = [res?.status?.Failure, ...(res?.receipts_outcome || []).map(o => o.outcome?.status?.Failure)].filter(Boolean);
  const args = res?.transaction?.actions?.[0]?.FunctionCall;
  console.log(t.transaction_hash.slice(0, 10), fails.length ? JSON.stringify(fails[0]).slice(0, 400) : 'SUCCESS');
  if (args) console.log('  args:', Buffer.from(args.args, 'base64').toString().slice(0, 300), '| deposit:', args.deposit);
}
