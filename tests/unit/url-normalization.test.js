/**
 * Unit tests for URL normalization in JiraClient
 * 
 * These tests verify URL normalization behavior without making network calls.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { JiraClient } from '../../dist/jira/client.js';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('normalizeBaseUrl trims whitespace', async () => {
  const client = new JiraClient({
    baseUrl: '  https://test.atlassian.net  ',
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
  
  await client.getJson('/rest/api/3/myself');
  assert.ok(capturedUrl, 'fetch should have been called');
  assert.ok(capturedUrl.startsWith('https://test.atlassian.net'), 'URL should be trimmed');
  assert.ok(!capturedUrl.includes('  '), 'URL should not contain leading/trailing spaces');
});

test('normalizeBaseUrl strips trailing slashes', async () => {
  const client = new JiraClient({
    baseUrl: 'https://test.atlassian.net///',
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
  
  await client.getJson('/rest/api/3/myself');
  assert.ok(capturedUrl, 'fetch should have been called');
  assert.equal(capturedUrl, 'https://test.atlassian.net/rest/api/3/myself', 'trailing slashes should be stripped');
});

test('normalizeBaseUrl throws when missing scheme', () => {
  assert.throws(
    () => new JiraClient({
      baseUrl: 'example.atlassian.net',
      auth: { type: 'basic', email: 'test@example.com', apiToken: 'token' },
    }),
    {
      name: 'Error',
      message: /JIRA_BASE_URL must start with http:\/\/ or https:\//,
    }
  );
});

