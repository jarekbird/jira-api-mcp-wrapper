/**
 * Contract tests for jira_update_issue_fields tool
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeJiraClient, parseToolText, expectIsError, buildTestServer, callTool } from './helpers.js';

test('jira_update_issue_fields calls PUT with correct body and query params', async () => {
  const fakeJira = new FakeJiraClient();
  fakeJira.setResponse('/rest/api/3/issue/TEST-1', {});
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_update_issue_fields', {
    issueKey: 'TEST-1',
    fields: { summary: 'Updated Summary' },
    notifyUsers: true,
    overrideScreenSecurity: false,
    overrideEditableFlag: false,
    validateAdf: true,
  });
  
  expectIsError(result, false);
  const parsed = parseToolText(result);
  assert.equal(parsed.success, true, 'should return success');
  assert.equal(parsed.issueKey, 'TEST-1', 'should return issue key');
  
  assert.equal(fakeJira.calls.length, 1, 'should make one API call');
  assert.equal(fakeJira.calls[0].method, 'PUT', 'should use PUT method');
  assert.equal(fakeJira.calls[0].path, '/rest/api/3/issue/TEST-1', 'should call correct endpoint');
  assert.deepEqual(fakeJira.calls[0].body.fields, { summary: 'Updated Summary' }, 'should include fields in body');
  assert.equal(fakeJira.calls[0].query.notifyUsers, true, 'should include notifyUsers query param');
});

test('jira_update_issue_fields validates ADF when validateAdf is true', async () => {
  const fakeJira = new FakeJiraClient();
  fakeJira.setResponse('/rest/api/3/issue/TEST-1', {});
  
  const server = buildTestServer(fakeJira);
  
  // Invalid ADF should cause validation error (missing version and content)
  const result = await callTool(server, 'jira_update_issue_fields', {
    issueKey: 'TEST-1',
    fields: {
      description: { type: 'doc' }, // Missing version and content - should fail validation
    },
    validateAdf: true,
  });
  
  // ADF validation throws an Error which gets caught and converted to tool error
  expectIsError(result, true);
  const parsed = parseToolText(result);
  // Error message should mention the field name and ADF validation issue
  const errorText = JSON.stringify(parsed);
  assert.ok(
    errorText.includes('description') || errorText.includes('version') || errorText.includes('content') || errorText.includes('ADF'),
    `Error should mention validation issue: ${errorText}`
  );
});

