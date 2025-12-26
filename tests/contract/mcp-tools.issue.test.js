/**
 * Contract tests for jira_get_issue tool
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeJiraClient, parseToolText, expectIsError, buildTestServer, callTool } from './helpers.js';

test('jira_get_issue calls correct endpoint with issue key', async () => {
  const fakeJira = new FakeJiraClient();
  const mockIssue = { id: '12345', key: 'TEST-1', fields: { summary: 'Test Issue' } };
  fakeJira.setResponse('/rest/api/3/issue/TEST-1', mockIssue);
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_get_issue', { issueKey: 'TEST-1' });
  
  expectIsError(result, false);
  const parsed = parseToolText(result);
  assert.equal(parsed.key, 'TEST-1', 'should return issue with correct key');
  
  assert.equal(fakeJira.calls.length, 1, 'should make one API call');
  assert.equal(fakeJira.calls[0].path, '/rest/api/3/issue/TEST-1', 'should call correct endpoint');
});

test('jira_get_issue includes fields and expand in query params', async () => {
  const fakeJira = new FakeJiraClient();
  fakeJira.setResponse('/rest/api/3/issue/TEST-1', { id: '12345', key: 'TEST-1' });
  
  const server = buildTestServer(fakeJira);
  await callTool(server, 'jira_get_issue', {
    issueKey: 'TEST-1',
    fields: ['summary', 'status'],
    expand: ['names', 'schema'],
  });
  
  assert.equal(fakeJira.calls[0].query.fields, 'summary,status', 'should include fields');
  assert.equal(fakeJira.calls[0].query.expand, 'names,schema', 'should include expand');
});

