import test from 'node:test';
import assert from 'node:assert/strict';
import { server, credentials } from './server.js';

test('health and authenticated screen-pop flow', async t => {
  await new Promise(resolve => server.listen(0, resolve));
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}`;
  const tokenResponse = await fetch(`${base}/services/oauth2/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'password', client_id: credentials.clientId, client_secret: credentials.clientSecret, username: credentials.username, password: credentials.password }) });
  assert.equal(tokenResponse.status, 200);
  const { access_token: token } = await tokenResponse.json();
  const response = await fetch(`${base}/services/data/v1.0/screenpop?phone=%2B15550100001`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.contact.firstName, 'Ada');
  assert.match(data.screenPopUrl, /screenpop\/003000000000001$/);
});
