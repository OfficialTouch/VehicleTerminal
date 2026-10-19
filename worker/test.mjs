// Run: node worker/test.mjs (mocks GitHub; no network needed)
import w from './worker.js';
const env = { DEV_USER: 'dev', DEV_PASS: 'pw-123', GH_TOKEN: 'x' };
let runs = [{ display_title: 'refresh ', status: 'completed', conclusion: 'success', created_at: 't', html_url: 'u' }], dispatched = null;
globalThis.fetch = async (url, init = {}) => {
  if (url.endsWith('/dispatches')) { dispatched = JSON.parse(init.body); return new Response(null, { status: 204 }); }
  return new Response(JSON.stringify({ workflow_runs: runs }), { status: 200 });
};
const call = async (path, method = 'GET', body, token) => { const r = await w.fetch(new Request('https://x' + path, { method, headers: { Origin: 'https://officialtouch.github.io', 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }), env); return [r.status, await r.json().catch(() => null), r.headers.get('access-control-allow-origin')]; };
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok', m); };
let [s, d] = await call('/login', 'POST', { user: 'dev', pass: 'nope' }); assert(s === 401, 'bad password rejected');
[s, d] = await call('/status'); assert(s === 401, 'status needs login');
[s, d] = await call('/login', 'POST', { user: 'DEV', pass: 'PW-123' }); assert(s === 401, 'password is case-sensitive');
[s, d] = await call('/login', 'POST', { user: ' Dev ', pass: 'pw-123 ' }); assert(s === 200 && d.token, 'login ok (username any case, spaces ignored)'); const t = d.token;
[s, d] = await call('/status', 'GET', null, t + 'x'); assert(s === 401, 'tampered token rejected');
[s, d] = await call('/status', 'GET', null, Date.now() - 1 + '.' + t.split('.')[1]); assert(s === 401, 'expired/forged exp rejected');
[s, d] = await call('/status', 'GET', null, t); assert(s === 200 && d.run.status === 'completed', 'status ok');
[s, d] = await call('/run', 'POST', { cmd: 'add', car: '<script>' }, t); assert(s === 400, 'bad car rejected');
[s, d] = await call('/run', 'POST', { cmd: 'rm -rf' }, t); assert(s === 400, 'bad cmd rejected');
[s, d] = await call('/run', 'POST', { cmd: 'add', car: 'Porsche 718 Cayman GTS 4.0 2020-2023' }, t); assert(s === 200 && dispatched.inputs.car.startsWith('Porsche') && dispatched.ref === 'main', 'add dispatched');
runs = [{ ...runs[0], status: 'in_progress' }];
[s, d] = await call('/run', 'POST', { cmd: 'refresh' }, t); assert(s === 409, 'blocked while running');
const r = await w.fetch(new Request('https://x/status', { method: 'OPTIONS', headers: { Origin: 'https://evil.com' } }), env); assert(r.headers.get('access-control-allow-origin') === 'https://officialtouch.github.io', 'cors locked');
