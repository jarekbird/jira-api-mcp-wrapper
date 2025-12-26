import test from 'node:test';
import assert from 'node:assert/strict';

import { JiraClient, JiraHttpError } from '../../dist/jira/client.js';

const originalFetch = globalThis.fetch;

test('JiraClient (basic auth) sets Authorization header', async () => {
  let seen;
  globalThis.fetch = async (url, opts) => {
    seen = { url, opts };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const client = new JiraClient({
    baseUrl: 'https://example.atlassian.net',
    auth: { type: 'basic', email: 'a@b.com', apiToken: 'tok' },
  });

  await client.getJson('/rest/api/3/field');

  const expected = `Basic ${Buffer.from('a@b.com:tok', 'utf8').toString('base64')}`;
  assert.equal(seen.opts.headers.Authorization, expected);
});

test('JiraClient (bearer auth) sets Authorization header', async () => {
  let seen;
  globalThis.fetch = async (url, opts) => {
    seen = { url, opts };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const client = new JiraClient({
    baseUrl: 'https://example.atlassian.net',
    auth: { type: 'bearer', token: 'abc123' },
  });

  await client.getJson('/rest/api/3/field');
  assert.equal(seen.opts.headers.Authorization, 'Bearer abc123');
});

test('putJson returns empty object on 204', async () => {
  // Undici Response disallows bodies for 204 responses; use null body.
  globalThis.fetch = async () => new Response(null, { status: 204 });

  const client = new JiraClient({
    baseUrl: 'https://example.atlassian.net',
    auth: { type: 'bearer', token: 'abc123' },
  });

  const res = await client.putJson('/rest/api/3/issue/TEST-1', { fields: { summary: 'x' } });
  assert.deepEqual(res, {});
});

test('postJson throws JiraHttpError and truncates bodyText', async () => {
  const big = 'x'.repeat(40_000);
  globalThis.fetch = async () =>
    new Response(big, {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'content-type': 'text/plain' },
    });

  const client = new JiraClient({
    baseUrl: 'https://example.atlassian.net',
    auth: { type: 'bearer', token: 'abc123' },
  });

  await assert.rejects(
    () => client.postJson('/rest/api/3/search', { jql: 'key=TEST-1' }),
    (err) => {
      assert.ok(err instanceof JiraHttpError);
      assert.equal(err.status, 400);
      assert.ok(typeof err.bodyText === 'string' && err.bodyText.length < 25_000);
      assert.ok(err.bodyText.endsWith('…(truncated)'));
      return true;
    }
  );
});

test('postJson returns JSON when content-type is application/json', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true, value: 123 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  const client = new JiraClient({
    baseUrl: 'https://example.atlassian.net',
    auth: { type: 'bearer', token: 'abc123' },
  });

  const res = await client.postJson('/rest/api/3/search', { jql: 'key=TEST-1' });
  assert.deepEqual(res, { ok: true, value: 123 });
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});


