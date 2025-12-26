/**
 * Unit tests for jiraClientFromEnv function
 * 
 * These tests verify environment variable parsing and JiraClient creation
 * without making any network calls.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { jiraClientFromEnv } from '../../dist/jira/client.js';

// Store original environment variables
const originalEnv = { ...process.env };

function restoreEnv() {
  // Clear all Jira-related env vars
  delete process.env.JIRA_BASE_URL;
  delete process.env.JIRA_BEARER_TOKEN;
  delete process.env.JIRA_EMAIL;
  delete process.env.JIRA_API_TOKEN;
  
  // Restore original values
  Object.assign(process.env, originalEnv);
}

test.afterEach(() => {
  restoreEnv();
});

test('missing JIRA_BASE_URL throws with clear message', () => {
  restoreEnv();
  delete process.env.JIRA_BASE_URL;
  
  assert.throws(
    () => jiraClientFromEnv(),
    {
      name: 'Error',
      message: 'Missing required env var: JIRA_BASE_URL',
    }
  );
});

test('JIRA_BEARER_TOKEN set → selects bearer auth even if JIRA_EMAIL/JIRA_API_TOKEN are present', async () => {
  restoreEnv();
  process.env.JIRA_BASE_URL = 'https://test.atlassian.net';
  process.env.JIRA_BEARER_TOKEN = 'bearer-token-123';
  process.env.JIRA_EMAIL = 'test@example.com';
  process.env.JIRA_API_TOKEN = 'api-token-456';
  
  const client = jiraClientFromEnv();
  
  // Verify bearer auth is used by checking Authorization header in a mocked request
  const originalFetch = globalThis.fetch;
  let capturedHeaders = null;
  
  globalThis.fetch = async (url, opts) => {
    capturedHeaders = opts.headers;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  
  try {
    await client.getJson('/rest/api/3/myself');
    assert.ok(capturedHeaders, 'fetch should have been called');
    assert.equal(capturedHeaders.Authorization, 'Bearer bearer-token-123', 'should use bearer token, not basic auth');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

