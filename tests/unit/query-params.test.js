/**
 * Unit tests for query parameter encoding in JiraClient
 * 
 * These tests verify query parameter handling without making network calls.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { JiraClient } from '../../dist/jira/client.js';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('query params include string|number|boolean, exclude undefined', async () => {
  const client = new JiraClient({
    baseUrl: 'https://test.atlassian.net',
    auth: { type: 'basic', email: 'test@example.com', apiToken: 'token' },
  });
  
  let capturedUrl = null;
  globalThis.fetch = async (url) => {
    capturedUrl = url;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  
  await client.getJson('/rest/api/3/search', {
    query: 'test',
    maxResults: 50,
    expand: true,
    skip: undefined,
  });
  
  assert.ok(capturedUrl, 'fetch should have been called');
  const url = new URL(capturedUrl);
  assert.equal(url.searchParams.get('query'), 'test', 'string param should be included');
  assert.equal(url.searchParams.get('maxResults'), '50', 'number param should be included');
  assert.equal(url.searchParams.get('expand'), 'true', 'boolean param should be included');
  assert.equal(url.searchParams.get('skip'), null, 'undefined param should be excluded');
});

