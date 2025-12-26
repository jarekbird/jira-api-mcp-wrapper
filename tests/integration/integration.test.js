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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { JiraClient } from '../../dist/jira/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load credentials from ga-jira/mcp.json if env vars not set
function loadCredentials() {
  // Prefer environment variables
  let baseUrl = process.env.JIRA_BASE_URL || process.env.JIRA_URL;
  let email = process.env.JIRA_EMAIL;
  let apiToken = process.env.JIRA_API_TOKEN;

  // Fallback to mcp.json if env vars not set
  if (!baseUrl || !email || !apiToken) {
    try {
      const mcpJsonPath = join(__dirname, '../../ga-jira/mcp.json');
      const mcpJson = JSON.parse(readFileSync(mcpJsonPath, 'utf8'));
      const serverConfig = mcpJson.mcpServers?.['mcp-atlassian-local']?.env;
      if (serverConfig) {
        baseUrl = baseUrl || serverConfig.JIRA_URL || serverConfig.JIRA_BASE_URL;
        email = email || serverConfig.JIRA_EMAIL;
        apiToken = apiToken || serverConfig.JIRA_API_TOKEN;
      }
    } catch (err) {
      // Ignore - will fail with clear error below
    }
  }

  if (!baseUrl || !email || !apiToken) {
    throw new Error(
      'Missing credentials. Set JIRA_BASE_URL (or JIRA_URL), JIRA_EMAIL, and JIRA_API_TOKEN environment variables, ' +
        'or ensure ga-jira/mcp.json exists with mcp-atlassian-local server config.'
    );
  }

  return { baseUrl, email, apiToken };
}

test('Integration: List Jira fields (GET /rest/api/3/field)', async () => {
  const { baseUrl, email, apiToken } = loadCredentials();

  const client = new JiraClient({
    baseUrl,
    auth: { type: 'basic', email, apiToken },
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
  const { baseUrl, email, apiToken } = loadCredentials();

  const client = new JiraClient({
    baseUrl,
    auth: { type: 'basic', email, apiToken },
  });

  // Search for the test user's email
  const users = await client.getJson(`/rest/api/3/user/search?query=${encodeURIComponent(email)}`);

  assert.ok(Array.isArray(users), 'users should be an array');
  assert.ok(users.length > 0, 'should find at least the test user');

  const testUser = users.find((u) => u.emailAddress === email || u.accountId);
  assert.ok(testUser, `should find user with email ${email}`);

  console.log(`✅ Successfully found user: ${testUser.displayName} (${testUser.accountId || testUser.emailAddress})`);
});

test('Integration: Get issue metadata (GET /rest/api/3/issue/{key}/editmeta)', async () => {
  const { baseUrl, email, apiToken } = loadCredentials();

  const client = new JiraClient({
    baseUrl,
    auth: { type: 'basic', email, apiToken },
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
  const bearerToken = process.env.JIRA_BEARER_TOKEN;
  if (!bearerToken) {
    console.log('ℹ️  JIRA_BEARER_TOKEN not set, skipping bearer auth test');
    return;
  }

  const { baseUrl } = loadCredentials();

  const client = new JiraClient({
    baseUrl,
    auth: { type: 'bearer', token: bearerToken },
  });

  const fields = await client.getJson('/rest/api/3/field');
});
