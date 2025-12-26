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

