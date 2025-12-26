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

test('query params are URL-encoded correctly (spaces, +, &, etc)', async () => {
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
    query: 'test query with spaces & special+chars',
  });
  
  assert.ok(capturedUrl, 'fetch should have been called');
  const url = new URL(capturedUrl);
  assert.equal(url.searchParams.get('query'), 'test query with spaces & special+chars', 'decoded value should match');
  // Verify encoding in the actual URL string (URLSearchParams encodes spaces as + or %20)
  assert.ok(
    capturedUrl.includes('query=test') && (capturedUrl.includes('%20') || capturedUrl.includes('+')),
    'spaces should be encoded in URL'
  );
  // Verify & is encoded
  assert.ok(capturedUrl.includes('%26') || capturedUrl.includes('&amp;'), '& should be encoded');
});

test('path concatenation is correct and does not double-slash', async () => {
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
  
  // Test with base URL that has trailing slash
  const clientWithSlash = new JiraClient({
    baseUrl: 'https://test.atlassian.net/',
    auth: { type: 'basic', email: 'test@example.com', apiToken: 'token' },
  });
  
  await clientWithSlash.getJson('/rest/api/3/myself');
  assert.ok(capturedUrl, 'fetch should have been called');
  assert.equal(capturedUrl, 'https://test.atlassian.net/rest/api/3/myself', 'should not have double slashes');
  assert.ok(!capturedUrl.includes('//rest'), 'should not have double slashes between base and path');
  
  // Test with path that starts with slash
  await client.getJson('/rest/api/3/myself');
  assert.equal(capturedUrl, 'https://test.atlassian.net/rest/api/3/myself', 'path concatenation should be correct');
});

