/**
 * Contract tests for jira_create_issue tool
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeJiraClient, parseToolText, expectIsError, buildTestServer, callTool } from './helpers.js';

test('jira_create_issue POST /rest/api/3/issue with fields', async () => {
  const fakeJira = new FakeJiraClient();
  const mockResult = { id: '12345', key: 'TEST-1', self: 'https://test.atlassian.net/rest/api/3/issue/12345' };
  fakeJira.setResponse('/rest/api/3/issue', mockResult);
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_create_issue', {
    fields: {
      project: { key: 'TEST' },
      issuetype: { name: 'Task' },
      summary: 'Test Issue',
    },
    validateAdf: true,
  });
  
  expectIsError(result, false);
  const parsed = parseToolText(result);
  assert.equal(parsed.key, 'TEST-1', 'should return created issue key');
  
  assert.equal(fakeJira.calls.length, 1, 'should make one API call');
  assert.equal(fakeJira.calls[0].method, 'POST', 'should use POST method');
  assert.equal(fakeJira.calls[0].path, '/rest/api/3/issue', 'should call correct endpoint');
  assert.deepEqual(fakeJira.calls[0].body.fields, {
    project: { key: 'TEST' },
    issuetype: { name: 'Task' },
    summary: 'Test Issue',
  }, 'should include fields in body');
});

test('jira_create_issue validates ADF when validateAdf=true', async () => {
  const fakeJira = new FakeJiraClient();
  fakeJira.setResponse('/rest/api/3/issue', { id: '12345', key: 'TEST-1' });
  
  const server = buildTestServer(fakeJira);
  
  // Invalid ADF should cause validation error
  const result = await callTool(server, 'jira_create_issue', {
    fields: {
      project: { key: 'TEST' },
      issuetype: { name: 'Task' },
      description: { type: 'doc' }, // Missing version and content
    },
    validateAdf: true,
  });
  
  expectIsError(result, true);
  const parsed = parseToolText(result);
  const errorText = JSON.stringify(parsed);
  assert.ok(errorText.includes('description') || errorText.includes('version') || errorText.includes('content'), 'should return ADF validation error');
});

