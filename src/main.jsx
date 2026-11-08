import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { Buffer } from 'buffer';

window.Buffer = window.Buffer || Buffer;
window.global = window.global || window;
window.process = window.process || { env: {} };

const root = document.getElementById('root');
const show = e => {
  root.innerHTML = '<pre style="padding:16px;white-space:pre-wrap;color:#b91c1c;font-size:13px">'
    + String(e?.stack || e).replace(/</g, '&lt;') + '</pre>';
};
window.addEventListener('error', e => { if (!root.children.length) show(e.error || e.message); });
window.addEventListener('unhandledrejection', e => { if (!root.children.length) show(e.reason); });

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { show(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

import('./App.jsx')
  .then(m => { const App = m.default; createRoot(root).render(<Boundary><App /></Boundary>); })
  .catch(show);
