/**
 * Integration tests for jira-api-mcp-wrapper
 *
 * These tests make REAL HTTP calls to Jira Cloud using actual credentials.
 * They require:
 * - JIRA_BASE_URL (or JIRA_URL) environment variable
 * - JIRA_EMAIL environment variable
 * - JIRA_API_TOKEN environment variable
 *
 * To run: npm run test:integration
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JiraClient } from '../../dist/jira/client.js';

// Load credentials from environment variables only
function loadCredentials() {
  const baseUrl = process.env.JIRA_BASE_URL || process.env.JIRA_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const bearerToken = process.env.JIRA_BEARER_TOKEN;

  const missing = [];
  if (!baseUrl) missing.push('JIRA_BASE_URL (or JIRA_URL)');
  if (!bearerToken && !email) missing.push('JIRA_EMAIL');
  if (!bearerToken && !apiToken) missing.push('JIRA_API_TOKEN');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for integration tests: ${missing.join(', ')}\n` +
        'Set these variables or use JIRA_BEARER_TOKEN for bearer authentication.\n' +
        'To run integration tests: npm run test:integration'
    );
  }

  return { baseUrl, email, apiToken, bearerToken };
}

test('Integration: List Jira fields (GET /rest/api/3/field)', async () => {
  const { baseUrl, email, apiToken, bearerToken } = loadCredentials();

  const client = new JiraClient({
    baseUrl,
    auth: bearerToken ? { type: 'bearer', token: bearerToken } : { type: 'basic', email, apiToken },
  });

  const fields = await client.getJson('/rest/api/3/field');

  assert.ok(Array.isArray(fields), 'fields should be an array');
  assert.ok(fields.length > 0, 'should return at least one field');

  // Verify structure of first field
  const firstField = fields[0];
  assert.ok(typeof firstField.id === 'string', 'field should have id');
  assert.ok(typeof firstField.name === 'string', 'field should have name');
  assert.ok(typeof firstField.schema === 'object' || firstField.schema === null, 'field should have schema');

  console.log(`✅ Successfully listed ${fields.length} Jira fields`);
  console.log(`   Example field: ${firstField.id} (${firstField.name})`);
});

test('Integration: Search users (GET /rest/api/3/user/search)', async () => {
  const { baseUrl, email, apiToken, bearerToken } = loadCredentials();

  const client = new JiraClient({
    baseUrl,
    auth: bearerToken ? { type: 'bearer', token: bearerToken } : { type: 'basic', email, apiToken },
  });

  // Search for a test query (use email if available, otherwise generic search)
  const searchQuery = email || 'test';
  const users = await client.getJson('/rest/api/3/user/search', { query: searchQuery, maxResults: 10 });

  assert.ok(Array.isArray(users), 'users should be an array');
  // Note: May not find users if search is restricted, so just verify structure
  if (users.length > 0) {
    const firstUser = users[0];
    assert.ok(typeof firstUser.accountId === 'string', 'user should have accountId');
    console.log(`✅ Successfully found ${users.length} user(s)`);
  } else {
    console.log('⚠️  No users found (this may be normal if search is restricted)');
  }
});

test('Integration: Get issue metadata (GET /rest/api/3/issue/{key}/editmeta)', async () => {
  const { baseUrl, email, apiToken, bearerToken } = loadCredentials();

  const client = new JiraClient({
    baseUrl,
    auth: bearerToken ? { type: 'bearer', token: bearerToken } : { type: 'basic', email, apiToken },
  });

  // Try to get editmeta for a known project (WOR) - this tests project access
  // Use JQL search endpoint (v3) to find any issue we can access
  try {
    const searchResult = await client.postJson('/rest/api/3/search', {
      jql: 'project = WOR ORDER BY created DESC',
      maxResults: 1,
      fields: ['key'],
    });

    if (searchResult.issues && searchResult.issues.length > 0) {
      const issueKey = searchResult.issues[0].key;
      const editmeta = await client.getJson(`/rest/api/3/issue/${issueKey}/editmeta`);

      assert.ok(typeof editmeta === 'object', 'editmeta should be an object');
      assert.ok(typeof editmeta.fields === 'object', 'editmeta should have fields');

      console.log(`✅ Successfully retrieved editmeta for issue ${issueKey}`);
      console.log(`   Available fields: ${Object.keys(editmeta.fields).length}`);
    } else {
      console.log('⚠️  No issues found in WOR project, skipping editmeta test');
    }
  } catch (err) {
    // Some Jira instances may have search disabled or require different permissions
    if (err.status === 410 || err.status === 403) {
      console.log(`⚠️  Search endpoint returned ${err.status}, skipping editmeta test (this is OK)`);
      return;
    }
    throw err;
  }
});

test('Integration: Bearer token auth (if JIRA_BEARER_TOKEN is set)', async () => {
  const { baseUrl, bearerToken } = loadCredentials();
  
  if (!bearerToken) {
    console.log('ℹ️  JIRA_BEARER_TOKEN not set, skipping bearer auth test');
    return;
  }

  const client = new JiraClient({
    baseUrl,
    auth: { type: 'bearer', token: bearerToken },
  });

  const fields = await client.getJson('/rest/api/3/field');
  assert.ok(Array.isArray(fields), 'should return fields array with bearer auth');
  console.log('✅ Bearer token authentication works');
});
