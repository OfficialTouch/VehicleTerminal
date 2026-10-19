// Vehicle Terminal API (Cloudflare Worker): developer login, start a data job, report its status.
// Secrets (set by .github/workflows/deploy-worker.yml from repo secrets): DEV_USER, DEV_PASS, GH_TOKEN.
const REPO = 'OfficialTouch/VehicleTerminal';
const WORKFLOW = 'terminal.yml';
const ORIGINS = ['https://officialtouch.github.io', 'http://localhost:8765'];
const SESSION_DAYS = 7;
const CAR_RE = /^[A-Za-z0-9 .,()\/&'+\-]{2,80}$/;

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
// constant-time compare of two strings (via their hashes, so lengths don't leak)
async function same(a, b) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(String(s)))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0; for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}
// session token = "<expiry ms>.<HMAC of expiry keyed by the login>"; changing the password logs everyone out
const sign = (env, exp) => hmac(env.DEV_USER + ':' + env.DEV_PASS, String(exp));
async function authed(req, env) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, await sign(env, exp));
}

const gh = (env, path, init = {}) => fetch('https://api.github.com/repos/' + REPO + path, {
  ...init,
  headers: { Authorization: 'Bearer ' + env.GH_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'vehicle-terminal-api', 'X-GitHub-Api-Version': '2022-11-28', ...(init.headers || {}) },
});
async function latestRun(env) {
  const r = await gh(env, `/actions/workflows/${WORKFLOW}/runs?per_page=1`);
  if (!r.ok) throw new Error('GitHub ' + r.status);
  const run = (await r.json()).workflow_runs[0];
  return run ? { title: run.display_title, status: run.status, conclusion: run.conclusion, started: run.created_at, url: run.html_url } : null;
}

async function handle(req, env) {
  const { pathname } = new URL(req.url);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

  if (pathname === '/login' && req.method === 'POST') {
    // username ignores case; both ignore stray spaces (easy to add when pasting into the dashboard)
    const ok = (await same(String(body.user || '').trim().toLowerCase(), String(env.DEV_USER || '').trim().toLowerCase())) & (await same(String(body.pass || '').trim(), String(env.DEV_PASS || '').trim()));
    if (!ok) { await new Promise((r) => setTimeout(r, 800)); return [401, { error: 'Wrong username or password' }]; } // shortcut: delay only, no lockout; add KV rate-limit if abused
    const exp = Date.now() + SESSION_DAYS * 864e5;
    return [200, { token: exp + '.' + (await sign(env, exp)), exp }];
  }

  if (!(await authed(req, env))) return [401, { error: 'Please log in again' }];

  if (pathname === '/status' && req.method === 'GET') return [200, { run: await latestRun(env) }];

  if (pathname === '/run' && req.method === 'POST') {
    const cmd = body.cmd, car = String(body.car || '').trim();
    if (!['news', 'refresh', 'add'].includes(cmd)) return [400, { error: 'Unknown command' }];
    if (cmd === 'add' && !CAR_RE.test(car)) return [400, { error: 'Type the car like: Porsche 718 Cayman GTS 4.0 2020-2023' }];
    const last = await latestRun(env);
    if (last && last.status !== 'completed') return [409, { error: 'A job is already running: ' + last.title }];
    const r = await gh(env, `/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main', inputs: { cmd, car: cmd === 'add' ? car : '' } }) });
    if (r.status !== 204) return [502, { error: 'GitHub refused the job (' + r.status + ')' }];
    return [200, { ok: true }];
  }
  return [404, { error: 'Not found' }];
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let status, data;
    try { [status, data] = await handle(req, env); } catch (e) { [status, data] = [500, { error: e.message }]; }
    return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
