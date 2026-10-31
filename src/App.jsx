import { useCallback, useEffect, useMemo, useState } from 'react';
import { setupWalletSelector } from '@near-wallet-selector/core';
import { setupModal } from '@near-wallet-selector/modal-ui';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import '@near-wallet-selector/modal-ui/styles.css';
import './styles.css';
import { encodeFunctionData, parseAbi } from 'viem';

const api = async (path, body) => {
  const response = await fetch('/api' + path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : undefined);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
};

const hue = value => [...value].reduce((total, char) => total * 31 + char.charCodeAt(0), 7) % 70 + 160;
const STEPS = ['Sent to vault', 'Minting on Base', 'Live on OpenSea'];
const STATUS_STEP = { created: 0, minting: 1, minted: 3, redeemed: 3, failed: 0 };

function Icon({ name, size = 19 }) {
  const paths = {
    grid: <><rect x="3.5" y="3.5" width="6" height="6" rx="1.5" /><rect x="14.5" y="3.5" width="6" height="6" rx="1.5" /><rect x="3.5" y="14.5" width="6" height="6" rx="1.5" /><rect x="14.5" y="14.5" width="6" height="6" rx="1.5" /></>,
    collection: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m4 16 5-5 4 4 3-3 4 4M8 8h.01" /></>,
    history: <><path d="M3 12a9 9 0 1 0 2.7-6.4L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.7" /><path d="m16 16 4 4" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2.5" /><path d="M3 8h18m-5 5h.01" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    external: <><path d="M14 4h6v6m-1-5-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></>,
    return: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-2" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.sparkle}</svg>;
}

function Artwork({ nft, className = '' }) {
  const key = nft ? `${nft.contract}${nft.tokenId}` : 'opennear-editorial';
  return <div className={`artwork ${className}`} style={{ '--art-hue': hue(key) }}>
    <div className="art-grain" />
    <span className="art-orbit orbit-a" />
    <span className="art-orbit orbit-b" />
    <span className="art-orbit orbit-c" />
    <span className="art-sculpture" />
    {nft?.media && <img src={nft.media} alt={nft.title || 'NFT artwork'} onError={event => event.currentTarget.remove()} />}
    {!nft?.media && <span className="art-label">{nft?.collection || 'OPENNEAR · ART STUDY'}</span>}
  </div>;
}

function Brand({ compact = false }) {
  return <span className={`brand ${compact ? 'brand-compact' : ''}`}><span className="brand-mark">O</span><span>OpenNear</span></span>;
}

export default function App() {
  const [selector, setSelector] = useState(null);
  const [account, setAccount] = useState(null);
  const [nfts, setNfts] = useState(null);
  const [orders, setOrders] = useState([]);
  const [config, setConfig] = useState({});
  const [evmAddress, setEvmAddress] = useState(localStorage.evm || '');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [contractLookup, setContractLookup] = useState('');
  const [appliedContract, setAppliedContract] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [inventoryError, setInventoryError] = useState('');
  const [activeSection, setActiveSection] = useState('overview');

  const notify = message => {
    setNotice(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setNotice(''), 5200);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedContract(contractLookup.trim()), 450);
    return () => window.clearTimeout(timer);
  }, [contractLookup]);

  useEffect(() => {
    api('/config').then(cfg => { setConfig(cfg); return setupWalletSelector({ network: cfg.network, modules: [setupMyNearWallet()] }); })
      .then(walletSelector => {
        setSelector(walletSelector);
        const first = walletSelector.store.getState().accounts[0];
        if (first) setAccount(first.accountId);
        walletSelector.store.observable.subscribe(state => setAccount(state.accounts[0]?.accountId || null));
      })
      .catch(() => notify('Wallet selector could not load. Refresh to try again.'));
  }, []);

  const load = useCallback(async () => {
    if (!account) return;
    setNfts(null);
    setInventoryError('');
    try {
      const query = appliedContract ? `?contract=${encodeURIComponent(appliedContract)}` : '';
      setNfts(await api(`/nfts/${encodeURIComponent(account)}${query}`));
    } catch (error) {
      setNfts([]);
      setInventoryError(error.message);
      notify(error.message);
    }
    try {
      setOrders(await api('/orders?owner=' + encodeURIComponent(account)));
    } catch (error) {
      notify(error.message);
    }
  }, [account, appliedContract]);

  useEffect(() => { load(); }, [load]);

  const confirm = async (id, txHash) => {
    setBusy(true);
    try {
      const order = await api(`/orders/${id}/confirm`, { txHash });
      delete localStorage.pending;
      notify(order.status === 'minted' ? 'Your artwork is live on Base. OpenSea is ready in Activity.' : `Bridge failed: ${order.error || 'Please try again.'}`);
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
      load();
    }
  };

  useEffect(() => {
    const hashes = new URLSearchParams(location.search).get('transactionHashes');
    const pendingId = hashes && localStorage.pending;
    if (pendingId && account) {
      history.replaceState({}, '', location.pathname);
      confirm(pendingId, hashes.split(',')[0]);
    }
  }, [account]);

  useEffect(() => {
    if (!account || !orders.some(order => ['minting', 'returning'].includes(order.status) || (order.status === 'minted' && !config.demo))) return undefined;
    const timer = window.setInterval(() => api('/orders?owner=' + encodeURIComponent(account)).then(setOrders).catch(() => {}), 6000);
    return () => window.clearInterval(timer);
  }, [orders, load]);

  const bridge = async nft => {
    if (!account || !selector) return;
    if (!/^0x[0-9a-fA-F]{40}$/.test(evmAddress)) {
      notify('Enter a valid 0x Base wallet address to continue.');
      return;
    }
    setBusy(true);
    try {
      localStorage.evm = evmAddress;
      const order = await api('/orders', {
        owner: account,
        contract: nft.contract,
        tokenId: nft.tokenId,
        evmTo: evmAddress,
        title: nft.title,
        media: nft.media,
      });
      if (order.demo) { await confirm(order.id); return; }
      localStorage.pending = order.id;
      const wallet = await selector.wallet();
      const outcome = await wallet.signAndSendTransaction({
        receiverId: nft.contract,
        actions: [{ type: 'FunctionCall', params: { methodName: 'nft_transfer', args: { receiver_id: order.vault, token_id: nft.tokenId, memo: order.id }, gas: '30000000000000', deposit: '1' } }],
      });
      await confirm(order.id, outcome?.transaction?.hash || outcome?.transaction_outcome?.id);
    } catch (error) {
      notify(error.message);
      setBusy(false);
    }
  };

  const redeem = async order => {
    setBusy(true);
    try {
      if (!config.demo) {
        const done = await api(`/orders/${order.id}/redeem`, {}).then(() => true, () => false);
        if (done) { notify('Returned to your NEAR wallet.'); return; }
        const eth = window.ethereum;
        if (!eth) throw new Error('Open this page in a browser with MetaMask (or another EVM wallet) to burn the wrapped NFT on Base.');
        const near = window.prompt('NEAR account that should receive the original NFT', order.owner);
        if (!near) return;
        await eth.request({ method: 'eth_requestAccounts' });
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: config.chainIdHex }] });
        const from = (await eth.request({ method: 'eth_accounts' }))[0];
        const data = encodeFunctionData({ abi: parseAbi(['function redeem(uint256,string)']), functionName: 'redeem', args: [BigInt(order.evmId), near.trim()] });
        await eth.request({ method: 'eth_sendTransaction', params: [{ from, to: config.wrapper, data }] });
        notify('Burn sent. The vault returns your NFT once Base confirms (about a minute).');
        return;
      }
      await api(`/orders/${order.id}/redeem`, {});
      notify('Returned to your NEAR wallet.');
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
      load();
    }
  };

  const mintTest = async () => {
    try {
      const wallet = await selector.wallet();
      await wallet.signAndSendTransaction({ receiverId: 'nft.examples.testnet', actions: [{ type: 'FunctionCall', params: { methodName: 'nft_mint', args: { token_id: `opennear-${Date.now()}`, receiver_id: account, token_metadata: { title: 'OpenNear Test NFT', description: 'Free testnet NFT for bridge testing' } }, gas: '30000000000000', deposit: '100000000000000000000000' } }] });
    } catch (error) { notify(error.message); }
  };
  const connect = () => selector ? setupModal(selector, {}).show() : notify('Wallet is loading…');
  const signOut = async () => {
    try {
      const wallet = await selector.wallet();
      await wallet.signOut();
    } catch (error) {
      notify(error.message || 'Could not disconnect this wallet.');
    }
  };

  const listedNfts = useMemo(() => (nfts || []).filter(item => `${item.title || ''} ${item.collection || ''} ${item.contract || ''} ${item.tokenId || ''}`.toLowerCase().includes(search.toLowerCase())), [nfts, search]);
  const selectedNft = listedNfts.find(item => `${item.contract}:${item.tokenId}` === selectedKey) || listedNfts[0];
  const selectedOrder = selectedNft && orders.find(order => order.contract === selectedNft.contract && order.tokenId === selectedNft.tokenId && order.status !== 'redeemed');
  const currentStep = selectedOrder ? STATUS_STEP[selectedOrder.status] : -1;
  const shortAccount = account ? `${account.slice(0, 8)}…${account.slice(-5)}` : '';

  const jumpTo = section => {
    setActiveSection(section);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(section)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  };

  if (!account) return <main className="home-page">
    <header className="landing-nav">
      <a href="#" className="brand-link" aria-label="OpenNear home"><Brand /></a>
      <nav className="landing-links" aria-label="Main navigation">
        <a href="#artwork">Discover</a><a href="#how-it-works">How it works</a><a href="#route">The bridge</a>
      </nav>
      <div className="landing-actions">
        <span className={`network-chip ${config.demo ? 'demo-chip' : ''}`}><i />{config.demo ? 'Demo environment' : 'NEAR · BASE'}</span>
        <button className="button button-dark nav-connect" onClick={connect}><Icon name="wallet" size={16} /> Connect wallet</button>
      </div>
    </header>

    <section className="landing-hero" id="artwork">
      <div className="hero-copy">
        <p className="eyebrow"><span className="eyebrow-line" /> A bridge for the art you own</p>
        <h1>Your NEAR art,<br /><em>out in the world.</em></h1>
        <p className="hero-description">Carry the NFTs you love from NEAR to Base. This is a custodial bridge: your original is held by the vault until you redeem it.</p>
        <div className="hero-cta-row">
          <button className="button button-dark button-large" onClick={connect}>Bridge your first NFT <Icon name="arrow" size={17} /></button>
          <a className="text-link" href="#how-it-works">See how it works <span>↓</span></a>
        </div>
        <div className="hero-footnote"><span className="tiny-stamp">N</span><span>NEAR native · Base ready</span><span className="footnote-divider" />Custodial bridge</div>
      </div>
      <div className="hero-art-stage" aria-label="Editorial abstract NFT artwork">
        <div className="hero-card-back back-one"><div className="mini-art mini-art-blue"><span /></div><span className="card-index">FIELD NOTES / 02</span></div>
        <div className="hero-card-back back-two"><div className="mini-art mini-art-pink"><span /></div><span className="card-index">FORM STUDY / 08</span></div>
        <div className="hero-art-card">
          <div className="artwork editorial-art"><div className="art-grain" /><span className="art-orbit orbit-a" /><span className="art-orbit orbit-b" /><span className="art-orbit orbit-c" /><span className="art-sculpture" /><span className="art-label">OPENNEAR · OBJECT 001</span></div>
          <div className="hero-art-meta"><div><small>Featured object</small><strong>Otherworldly forms</strong></div><span className="edition-mark">01 <i>/</i> 24</span></div>
        </div>
        <div className="float-note note-route"><span className="route-arrow">N<span>→</span>B</span><span><b>NEAR to Base</b><small>One artwork. Two worlds.</small></span></div>
        <div className="float-note note-secure"><span className="secure-mark"><Icon name="check" size={15} /></span><span><b>Original in vault</b><small>Custodial hold until redeemed</small></span></div>
        <span className="stage-asterisk" aria-hidden="true">*</span>
        <span className="art-caption">COLLECT · CARRY · RETURN</span>
      </div>
    </section>

    <section className="landing-strip" aria-label="Bridge highlights">
      <span>Made for collectors</span><i /><span>Built on NEAR</span><i /><span>Wrapped on Base</span><i /><span>Return whenever you like</span>
    </section>

    <section className="how-section" id="how-it-works">
      <div className="section-heading">
        <p className="eyebrow"><span className="eyebrow-line" /> The simple route</p>
        <h2>Keep the original.<br /><em>Take the other side.</em></h2>
      </div>
      <div className="route-steps" id="route">
        <article className="route-step"><span className="step-number">01</span><span className="step-icon"><Icon name="wallet" size={21} /></span><h3>Connect your NEAR wallet</h3><p>Choose the artwork in your collection and tell us where it should arrive on Base.</p></article>
        <article className="route-step"><span className="step-number">02</span><span className="step-icon"><Icon name="collection" size={21} /></span><h3>Send it to the vault</h3><p>Your NFT is transferred to the bridge vault. You approve the transfer in your wallet.</p></article>
        <article className="route-step"><span className="step-number">03</span><span className="step-icon"><Icon name="sparkle" size={21} /></span><h3>Collect across chains</h3><p>A wrapped edition is minted on Base, ready to view and trade on OpenSea.</p></article>
      </div>
      <div className="return-note"><span className="return-symbol"><Icon name="return" size={19} /></span><span><b>And back again.</b> Burn the wrapped token on Base, then redeem the original to NEAR.</span></div>
    </section>

    <footer className="landing-footer"><a href="#" className="brand-link"><Brand /></a><span>Art travels. The return path stays open.</span><button className="footer-connect" onClick={connect}>Open your collection <Icon name="arrow" size={16} /></button></footer>
    {notice && <div className="toast" role="status">{notice}</div>}
  </main>;

  return <main className="dashboard">
    <aside className="side-rail">
      <a href="#" className="rail-brand" aria-label="OpenNear home"><span className="brand-mark">O</span></a>
      <span className="rail-label">WORKSPACE</span>
      <nav className="rail-nav" aria-label="Dashboard navigation">
        <button className={activeSection === 'overview' ? 'rail-item active' : 'rail-item'} onClick={() => jumpTo('overview')}><Icon name="grid" /><span>Overview</span></button>
        <button className={activeSection === 'collection' ? 'rail-item active' : 'rail-item'} onClick={() => jumpTo('collection')}><Icon name="collection" /><span>My collection</span></button>
        <button className={activeSection === 'activity' ? 'rail-item active' : 'rail-item'} onClick={() => jumpTo('activity')}><Icon name="history" /><span>Activity</span></button>
      </nav>
      <div className="rail-bottom"><span className={`rail-network ${config.demo ? 'is-demo' : ''}`}><i />{config.demo ? 'Demo mode' : `NEAR ${config.network}`}</span><span className="rail-version">OPENNEAR · 01</span></div>
    </aside>

    <div className="dashboard-main">
      <header className="dashboard-topbar">
        <div className="mobile-brand"><Brand compact /></div>
        <label className="search-field"><Icon name="search" size={18} /><input aria-label="Search your NFTs" placeholder="Search your collection…" value={search} onChange={event => setSearch(event.target.value)} /><kbd>/</kbd></label>
        <div className="topbar-right">
          <span className={`network-chip ${config.demo ? 'demo-chip' : ''}`}><i />{config.demo ? 'Demo mode' : `NEAR ${config.network}`}</span>
          <button className="account-pill" onClick={signOut} title="Disconnect wallet"><span className="account-avatar">{account.slice(0, 1).toUpperCase()}</span><span>{shortAccount}</span><span className="signout-label">Sign out</span></button>
        </div>
      </header>

      <div className="dashboard-layout">
        <section className="workspace-column">
          <div className="welcome-row" id="overview">
            <div><p className="eyebrow"><span className="eyebrow-line" /> YOUR ART, IN MOTION</p><h1>Good to see you<span className="welcome-dot">.</span></h1><p className="welcome-subtitle">Your collection is ready to cross over.</p></div>
            <span className="date-stamp">NEAR <b>→</b> BASE<br /><small>BRIDGE DESK · 01</small></span>
          </div>

          {(config.demo || config.network === 'testnet') && <div className="setup-banner" role="status"><span>{config.demo ? <><b>Demo mode.</b> Nothing is sent on-chain. Missing: {(config.missing || []).join(', ') || 'none (DEMO=true)'}.</> : <><b>Testnet.</b> Real transactions, no real money.</>}</span>{config.network === 'testnet' && <button className="text-button" onClick={mintTest}>Mint a free test NFT</button>}</div>}
          <section className="featured-work">
            <div className="featured-image">
              {nfts === null ? <div className="skeleton featured-skeleton"><span /><span /><span /></div> : selectedNft ? <Artwork nft={selectedNft} className="selected-art" /> :
                <div className="empty-art"><span className="empty-art-mark"><Icon name="collection" size={24} /></span><b>{inventoryError ? 'Collection unavailable' : search ? 'No matches in this collection' : 'Your collection is quiet'}</b><span>{inventoryError ? 'Try loading your NFTs again.' : search ? 'Try another title, collection, or token.' : 'Connect a contract or check back after collecting on NEAR.'}</span>{inventoryError && <button className="button button-dark small-button" onClick={load}>Retry inventory</button>}</div>}
              {selectedNft && <span className="featured-edition">NEAR ORIGINAL <i>·</i> #{selectedNft.tokenId}</span>}
            </div>
            <div className="featured-details">
              <div className="featured-topline"><span className="eyebrow">SELECTED ARTWORK</span><span className="collection-dot"><Icon name="sparkle" size={15} /></span></div>
              {selectedNft ? <>
                <h2>{selectedNft.title || `Token ${selectedNft.tokenId}`}</h2>
                <p className="collection-name">{selectedNft.collection || 'NEAR collection'} <span>·</span> Token #{selectedNft.tokenId}</p>
                <div className="featured-rule" />
                <label className="field-label" htmlFor="base-address">BASE DESTINATION</label>
                <input id="base-address" className="address-input" spellCheck="false" autoComplete="off" placeholder="0x wallet address" value={evmAddress} onChange={event => setEvmAddress(event.target.value.trim())} />
                <div className="feature-action-row">
                  {selectedOrder?.status === 'minted'
                    ? <a className="button button-dark featured-cta" href={selectedOrder.opensea || '#'} target="_blank" rel="noreferrer" onClick={event => !selectedOrder.opensea && event.preventDefault()}>View on OpenSea <Icon name="external" size={16} /></a>
                    : <button className="button button-dark featured-cta" disabled={busy || (Boolean(selectedOrder) && selectedOrder.status !== 'failed')} onClick={() => bridge(selectedNft)}>{busy ? <><span className="button-progress" /> Preparing bridge</> : selectedOrder?.status === 'minting' ? 'Minting on Base' : 'Bridge to Base'} <Icon name="arrow" size={17} /></button>}
                  <span className="vault-caption"><span className="secure-dot" /> Held by bridge vault</span>
                </div>
                {selectedOrder?.status === 'failed' && <div className="inline-error" role="alert">{selectedOrder.error || 'The bridge did not complete.'}</div>}
                {selectedOrder?.status === 'created' && <div className="inline-pending"><span /> Waiting for wallet confirmation <button onClick={() => confirm(selectedOrder.id)}>Check status</button></div>}
              </> : <><h2>Make room for a new story.</h2><p className="collection-name">Your NEAR NFTs will appear here.</p><div className="featured-rule" /><p className="muted-copy">Paste a collection contract below to look up an artwork you want to bridge.</p></>}
            </div>
          </section>

          <section className="collection-section" id="collection">
            <div className="section-title-row"><div><p className="eyebrow"><span className="eyebrow-line" /> YOUR COLLECTION</p><h2>Collected on NEAR <span className="count-badge">{nfts?.length ?? '—'}</span></h2></div><span className="collection-caption">Select a piece to bridge</span></div>
            <div className="collection-tools">
              <label className="contract-search"><Icon name="search" size={16} /><input aria-label="Look up a collection by contract" placeholder="Look up NFT contract…" value={contractLookup} onChange={event => setContractLookup(event.target.value.trim())} onKeyDown={event => { if (event.key === 'Enter') setAppliedContract(contractLookup.trim()); }} /><span aria-hidden="true">↵</span></label>
              {contractLookup && <button className="clear-search" onClick={() => setContractLookup('')}><Icon name="close" size={14} /> Clear lookup</button>}
            </div>
            {nfts === null ? <div className="collection-grid" aria-label="Loading collection">{[0, 1, 2].map(index => <div className="collection-skeleton" key={index}><div /><span /><span /></div>)}</div> :
              listedNfts.length ? <div className="collection-grid">
                {listedNfts.map(item => {
                  const itemKey = `${item.contract}:${item.tokenId}`;
                  const isSelected = selectedNft && selectedNft.contract === item.contract && selectedNft.tokenId === item.tokenId;
                  return <button key={itemKey} className={`nft-tile ${isSelected ? 'is-selected' : ''}`} onClick={() => setSelectedKey(itemKey)} aria-pressed={Boolean(isSelected)}>
                    <Artwork nft={item} className="tile-art" /><span className="tile-info"><span><b>{item.title || `Token ${item.tokenId}`}</b><small>{item.collection || item.contract}</small></span><span className="tile-arrow"><Icon name={isSelected ? 'check' : 'arrow'} size={15} /></span></span>
                  </button>;
                })}
              </div> : <div className="collection-empty"><span className="empty-mark">N</span><div><b>{inventoryError ? 'We could not reach this collection.' : search || contractLookup ? 'Nothing found just yet.' : 'No NFTs surfaced yet.'}</b><p>{inventoryError || (contractLookup ? 'Check the contract address and try another.' : search ? 'Try a different title or collection name.' : 'Look up a collection contract above or refresh your wallet inventory.')}</p></div><button className="text-button" onClick={load}>Refresh <Icon name="arrow" size={15} /></button></div>}
          </section>
        </section>

        <aside className="context-column">
          <section className="bridge-panel">
            <div className="panel-heading"><div><p className="eyebrow">THE BRIDGE</p><h2>Follow your piece</h2></div><span className="bridge-spark"><Icon name="sparkle" size={17} /></span></div>
            <div className="bridge-route"><span className="chain-badge near-badge">N</span><span className="route-line"><i /></span><span className="chain-badge base-badge">B</span><div className="route-labels"><span>NEAR</span><span>BASE</span></div></div>
            {selectedOrder ? <>
              <div className="current-order"><span className="order-kicker">CURRENT JOURNEY</span><b>{selectedOrder.title || `Token ${selectedOrder.tokenId}`}</b><span>#{selectedOrder.tokenId} · {selectedOrder.contract.slice(0, 13)}…</span></div>
              <div className="progress-list">{STEPS.map((label, index) => <div key={label} className={`progress-step ${index < currentStep ? 'complete' : index === currentStep ? 'current' : ''} ${selectedOrder.status === 'failed' && index === 0 ? 'failed-step' : ''}`}><span className="progress-marker">{index < currentStep ? <Icon name="check" size={12} /> : index + 1}</span><span>{label}</span>{index === currentStep && selectedOrder.status === 'minting' && <i className="step-loader" />}</div>)}</div>
              {selectedOrder.status === 'failed' && <button className="panel-link retry-link" onClick={() => confirm(selectedOrder.id)}>Retry confirmation <Icon name="arrow" size={15} /></button>}
            </> : <div className="bridge-idle"><span className="idle-icon"><Icon name="arrow" size={18} /></span><b>A little journey starts here.</b><p>Choose an artwork, add your Base address, and we’ll show every step right here.</p></div>}
            <div className="bridge-foot"><span><i />Live status updates</span><span>4 sec refresh</span></div>
          </section>

          <section className="activity-panel" id="activity">
            <div className="panel-heading activity-heading"><div><p className="eyebrow">RECENT MOVEMENT</p><h2>Activity</h2></div><span className="activity-total">{orders.length.toString().padStart(2, '0')}</span></div>
            {orders.length ? <div className="activity-list">
              {orders.slice(0, 5).map(order => <article className="activity-item" key={order.id}>
                <span className={`activity-mark status-${order.status}`}>{order.status === 'minted' ? <Icon name="check" size={14} /> : order.status === 'redeemed' ? <Icon name="return" size={14} /> : <span className="activity-dot" />}</span>
                <div className="activity-copy"><b>{order.title || `Token ${order.tokenId}`}</b><span>{order.status === 'minted' ? 'Wrapped on Base' : order.status === 'redeemed' ? 'Returned to NEAR' : order.status === 'failed' ? 'Bridge needs attention' : order.status === 'minting' ? 'Minting on Base' : 'Sent to vault'}</span></div>
                <div className="activity-actions">
                  <span className={`status-tag tag-${order.status}`}>{order.status}</span>
                  {order.status === 'minted' && <><a href={order.opensea || '#'} onClick={event => !order.opensea && event.preventDefault()} target="_blank" rel="noreferrer" aria-label="Open on OpenSea"><Icon name="external" size={14} /></a><button onClick={() => redeem(order)} disabled={busy} aria-label="Redeem to NEAR"><Icon name="return" size={14} /></button></>}
                  {(order.status === 'created' || order.status === 'failed') && <button onClick={() => confirm(order.id)} disabled={busy} aria-label="Retry bridge confirmation"><Icon name="arrow" size={14} /></button>}
                </div>
              </article>)}
            </div> : <div className="activity-empty"><span><Icon name="history" size={18} /></span><p>Your bridge activity will find a home here.</p></div>}
            <div className="activity-note"><span className="vault-lock"><Icon name="check" size={13} /></span><span><b>Vault address</b><small>{config.vault || 'Loading vault…'}</small></span></div>
          </section>

          <div className="help-card"><span className="help-star" aria-hidden="true">*</span><div><b>Need your original back?</b><p>Burn your wrapped NFT on Base, then redeem it here.</p></div><button title="Open return instructions" onClick={() => notify('Burn your wrapped token on Base first, then use Return to NEAR in Activity.')}>?</button></div>
        </aside>
      </div>
      <footer className="dashboard-footer"><Brand compact /><span>Keep the original close. Let its story travel.</span><span>{config.wrapper ? `WRAPPER ${config.wrapper.slice(0, 8)}…` : 'NEAR → BASE'}</span></footer>
    </div>
    {notice && <div className="toast" role="status">{notice}</div>}
  </main>;
}
