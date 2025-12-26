/**
 * Contract test setup verification
 * 
 * Tests to verify the contract test infrastructure is working
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerJiraTools } from '../../dist/mcp/server.js';
import { FakeJiraClient } from './helpers.js';

test('registerJiraTools registers tools without errors (smoke check)', () => {
  const server = new McpServer({ name: 'test', version: '0.1.0' });
  const fakeJira = new FakeJiraClient();
  
  // Verify registerJiraTools doesn't throw
  assert.doesNotThrow(() => {
    registerJiraTools(server, fakeJira);
  }, 'registerJiraTools should not throw');
  
  assert.ok(server, 'Server should be created');
  assert.ok(fakeJira, 'Fake Jira client should be created');
  
  // Expected tools: jira_list_fields, jira_get_issue, jira_update_issue_fields,
  // jira_search_issues_jql, jira_create_issue, jira_add_comment, jira_get_transitions,
  // jira_transition_issue, jira_bulk_create_issues, jira_bulk_get_editable_fields,
  // jira_bulk_edit_issues, jira_search_users, jira_resolve_user_account_id
  // Actual tool count verification will be done in Phase 3 contract tests
});

