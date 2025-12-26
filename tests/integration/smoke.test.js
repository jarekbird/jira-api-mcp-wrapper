/**
 * Read-only integration smoke tests for jira-api-mcp-wrapper
 *
 * These tests make REAL HTTP calls to Jira Cloud using actual credentials.
 * They require:
 * - JIRA_BASE_URL (or JIRA_URL) environment variable
 * - JIRA_EMAIL and JIRA_API_TOKEN, OR JIRA_BEARER_TOKEN
 *
 * Optional test-specific variables:
 * - JIRA_TEST_USER_QUERY: User search query (default: uses JIRA_EMAIL if available)
 * - JIRA_TEST_JQL: JQL query for search test (default: conservative query)
 * - JIRA_TEST_ISSUE_KEY: Issue key for get/transitions tests
 *
 * To run: npm run test:integration
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JiraClient, jiraClientFromEnv } from '../../dist/jira/client.js';

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

test('Smoke: List fields', async () => {
  const client = jiraClientFromEnv();
  const fields = await client.getJson('/rest/api/3/field');

  assert.ok(Array.isArray(fields), 'fields should be an array');
  assert.ok(fields.length > 0, 'should return at least one field');

  const firstField = fields[0];
  assert.ok(typeof firstField.id === 'string', 'field should have id');
  assert.ok(typeof firstField.name === 'string', 'field should have name');

  console.log(`✅ Listed ${fields.length} fields (example: ${firstField.id})`);
});

test('Smoke: Search users', async () => {
  const { email } = loadCredentials();
  const client = jiraClientFromEnv();
  const query = process.env.JIRA_TEST_USER_QUERY || email || 'test';
  
  const users = await client.getJson('/rest/api/3/user/search', { query, maxResults: 10 });

  assert.ok(Array.isArray(users), 'users should be an array');
  if (users.length > 0) {
    const firstUser = users[0];
    assert.ok(typeof firstUser.accountId === 'string', 'user should have accountId');
    assert.ok(typeof firstUser.displayName === 'string', 'user should have displayName');
    console.log(`✅ Found ${users.length} user(s) (example: ${firstUser.displayName})`);
  } else {
    console.log('⚠️  No users found (may be normal if search is restricted)');
  }
});

test('Smoke: JQL search', async () => {
  const client = jiraClientFromEnv();
  const jql = process.env.JIRA_TEST_JQL || 'ORDER BY created DESC';
  
  const result = await client.postJson('/rest/api/3/search', {
    jql,
    maxResults: 5,
    fields: ['key', 'summary'],
  });

  assert.ok(typeof result === 'object', 'result should be an object');
  assert.ok(Array.isArray(result.issues), 'result should have issues array');
  assert.ok(typeof result.total === 'number', 'result should have total count');
  
  console.log(`✅ JQL search returned ${result.issues.length} issue(s) (total: ${result.total})`);
});

test('Smoke: Get issue', async () => {
  const issueKey = process.env.JIRA_TEST_ISSUE_KEY;
  if (!issueKey) {
    console.log('ℹ️  JIRA_TEST_ISSUE_KEY not set, skipping get issue test');
    return;
  }

  const client = jiraClientFromEnv();
  const issue = await client.getJson(`/rest/api/3/issue/${issueKey}`, {
    fields: ['key', 'summary', 'status'],
  });

  assert.ok(typeof issue === 'object', 'issue should be an object');
  assert.equal(issue.key, issueKey, 'issue key should match');
  assert.ok(issue.fields, 'issue should have fields');
  
  console.log(`✅ Retrieved issue ${issueKey}: ${issue.fields.summary}`);
});

test('Smoke: Get transitions', async () => {
  const issueKey = process.env.JIRA_TEST_ISSUE_KEY;
  if (!issueKey) {
    console.log('ℹ️  JIRA_TEST_ISSUE_KEY not set, skipping get transitions test');
    return;
  }

  const client = jiraClientFromEnv();
  const result = await client.getJson(`/rest/api/3/issue/${issueKey}/transitions`);

  assert.ok(typeof result === 'object', 'result should be an object');
  assert.ok(Array.isArray(result.transitions), 'result should have transitions array');
  
  console.log(`✅ Found ${result.transitions.length} transition(s) for issue ${issueKey}`);
});

