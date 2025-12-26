/**
 * Unit tests for timeout and AbortController behavior in JiraClient
 * 
 * These tests verify timeout handling deterministically without real timers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { JiraClient, JiraHttpError } from '../../dist/jira/client.js';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('timeout causes request rejection with AbortError', async () => {
  let abortSignal = null;
  let fetchCalled = false;
  
  globalThis.fetch = async (url, opts) => {
    fetchCalled = true;
    abortSignal = opts.signal;
    // Wait for abort signal to be triggered
    return new Promise((resolve, reject) => {
      if (abortSignal.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }
      abortSignal.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  };

  const client = new JiraClient({
    baseUrl: 'https://example.atlassian.net',
    auth: { type: 'bearer', token: 'abc123' },
    timeoutMs: 1, // Very short timeout
  });

  await assert.rejects(
    () => client.getJson('/rest/api/3/myself'),
    (err) => {
      assert.ok(err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('Abort'));
      return true;
    }
  );
  
  assert.ok(fetchCalled, 'fetch should have been called');
  assert.ok(abortSignal, 'AbortSignal should have been created');
});

test('AbortController signal is properly passed to fetch', async () => {
  let capturedSignal = null;
  globalThis.fetch = async (url, opts) => {
    capturedSignal = opts.signal;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const client = new JiraClient({
    baseUrl: 'https://example.atlassian.net',
    auth: { type: 'bearer', token: 'abc123' },
    timeoutMs: 30_000,
  });

  await client.getJson('/rest/api/3/myself');
  assert.ok(capturedSignal, 'AbortSignal should be passed to fetch');
  assert.ok(capturedSignal instanceof AbortSignal, 'signal should be an AbortSignal');
});

test('timeout is cleared after successful request', async () => {
  let timeoutIds = [];
  let clearedIds = [];
  
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  
  globalThis.setTimeout = (fn, delay) => {
    const id = originalSetTimeout(fn, delay);
    timeoutIds.push(id);
    return id;
  };
  
  globalThis.clearTimeout = (id) => {
    clearedIds.push(id);
    return originalClearTimeout(id);
  };

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  const client = new JiraClient({
    baseUrl: 'https://example.atlassian.net',
    auth: { type: 'bearer', token: 'abc123' },
    timeoutMs: 30_000,
  });

  await client.getJson('/rest/api/3/myself');
  
  // Restore originals
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  
  assert.ok(timeoutIds.length > 0, 'setTimeout should have been called');
  assert.ok(clearedIds.length > 0, 'clearTimeout should have been called');
  assert.ok(clearedIds.includes(timeoutIds[0]), 'timeout should be cleared after request completes');
});

