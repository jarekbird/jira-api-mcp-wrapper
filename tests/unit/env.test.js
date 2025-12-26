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

// Tests will be added in tasks 1.2, 1.3, 1.4

