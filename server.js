import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';

const port = Number(process.env.PORT || 5080);
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const tokenTtlSeconds = Number(process.env.TOKEN_TTL_SECONDS || 3600);
const credentials = {
  clientId: process.env.DEMO_CLIENT_ID || 'genesys-demo-client',
  clientSecret: process.env.DEMO_CLIENT_SECRET || 'genesys-demo-secret',
  username: process.env.DEMO_USERNAME || 'genesys@example.com',
  password: process.env.DEMO_PASSWORD || 'ChangeMe123!'
};

const contacts = [
  { id: '003000000000001', firstName: 'Ada', lastName: 'Lovelace', phone: '+15550100001', email: 'ada@example.com', accountName: 'Analytical Engines Ltd', status: 'Active' },
  { id: '003000000000002', firstName: 'Alan', lastName: 'Turing', phone: '+15550100002', email: 'alan@example.com', accountName: 'Enigma Labs', status: 'Active' },
  { id: '003000000000003', firstName: 'Grace', lastName: 'Hopper', phone: '+15550100003', email: 'grace@example.com', accountName: 'Compiler Systems', status: 'VIP' }
];
const tokens = new Map();

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 100_000) reject(new Error('Request body too large')); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function findContact(value) {
  const normalized = String(value || '').replace(/[^\d+]/g, '');
  return contacts.find(contact => contact.phone === value || contact.phone.replace(/\D/g, '') === normalized.replace(/\D/g, '') || contact.id === value);
}

function issueToken() {
  const accessToken = crypto.randomBytes(32).toString('hex');
  tokens.set(accessToken, Date.now() + tokenTtlSeconds * 1000);
  return accessToken;
}

function isAuthorized(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && tokens.has(token) && tokens.get(token) > Date.now();
}

function contactResponse(contact, req) {
  const base = publicBaseUrl || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  return {
    success: true,
    contact,
    screenPopUrl: `${base}/screenpop/${encodeURIComponent(contact.id)}`,
    screenPop: { url: `${base}/screenpop/${encodeURIComponent(contact.id)}`, target: 'screenpop' }
  };
}

function htmlScreenPop(contact) {
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  return `<!doctype html><html><head><meta charset="utf-8"><title>Contact ${esc(contact.firstName)} ${esc(contact.lastName)}</title><style>body{font:16px system-ui;margin:40px;color:#172033}main{max-width:620px;margin:auto;border:1px solid #d8deea;border-radius:12px;padding:28px;box-shadow:0 6px 24px #17203318}h1{margin-top:0}dt{font-weight:700;margin-top:14px}dd{margin:4px 0 0}</style></head><body><main><h1>${esc(contact.firstName)} ${esc(contact.lastName)}</h1><dl><dt>Account</dt><dd>${esc(contact.accountName)}</dd><dt>Phone</dt><dd>${esc(contact.phone)}</dd><dt>Email</dt><dd>${esc(contact.email)}</dd><dt>Status</dt><dd>${esc(contact.status)}</dd></dl></main></body></html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' }); return res.end(); }
  try {
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { status: 'ok', service: 'sf-demo-api' });

    if (req.method === 'POST' && url.pathname === '/services/oauth2/token') {
      const form = new URLSearchParams(await readBody(req));
      const grantType = form.get('grant_type');
      const validClient = form.get('client_id') === credentials.clientId && form.get('client_secret') === credentials.clientSecret;
      const validPassword = form.get('username') === credentials.username && form.get('password') === credentials.password;
      if (!validClient || (grantType === 'password' && !validPassword) || !['password', 'client_credentials'].includes(grantType)) return json(res, 400, { error: 'invalid_grant', error_description: 'Invalid client, credentials, or grant_type.' });
      const accessToken = issueToken();
      return json(res, 200, { access_token: accessToken, token_type: 'Bearer', expires_in: tokenTtlSeconds, instance_url: publicBaseUrl, issued_at: String(Date.now()) });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/screenpop/')) {
      const contact = contacts.find(item => item.id === decodeURIComponent(url.pathname.split('/').pop()));
      if (!contact) return json(res, 404, { error: 'not_found', message: 'Contact not found' });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(htmlScreenPop(contact));
    }

    if (!isAuthorized(req)) return json(res, 401, { error: 'invalid_session', message: 'Provide a valid Bearer token.' });
    if (req.method === 'GET' && (url.pathname === '/api/screenpop' || url.pathname === '/services/data/v1.0/screenpop')) {
      const contact = findContact(url.searchParams.get('phone') || url.searchParams.get('contactId'));
      if (!contact) return json(res, 404, { success: false, error: 'CONTACT_NOT_FOUND', message: 'No matching contact was found.' });
      return json(res, 200, contactResponse(contact, req));
    }
    if (req.method === 'GET' && url.pathname.startsWith('/services/data/v1.0/sobjects/Contact/')) {
      const contact = contacts.find(item => item.id === decodeURIComponent(url.pathname.split('/').pop()));
      if (!contact) return json(res, 404, { error: 'NOT_FOUND', message: 'Contact not found' });
      return json(res, 200, { ...contact, attributes: { type: 'Contact', url: `/services/data/v1.0/sobjects/Contact/${contact.id}` } });
    }
    json(res, 404, { error: 'not_found', message: 'Route not found' });
  } catch (error) { json(res, 500, { error: 'server_error', message: error.message }); }
});

if (process.argv[1] && process.argv[1].endsWith('server.js')) server.listen(port, () => console.log(`sf-demo-api listening on ${publicBaseUrl}`));
export { server, contacts, credentials, issueToken };
