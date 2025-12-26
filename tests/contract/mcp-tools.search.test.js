/**
 * Contract tests for jira_search_issues_jql tool
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeJiraClient, parseToolText, expectIsError, buildTestServer, callTool } from './helpers.js';

test('jira_search_issues_jql calls POST with correct JQL body', async () => {
  const fakeJira = new FakeJiraClient();
  const mockSearchResult = { issues: [], total: 0, maxResults: 50, startAt: 0 };
  fakeJira.setResponse('/rest/api/3/search', mockSearchResult);
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_search_issues_jql', {
    jql: 'project=TEST AND status=Open',
    maxResults: 50,
    startAt: 0,
  });
  
  expectIsError(result, false);
  const parsed = parseToolText(result);
  assert.ok(parsed.issues !== undefined, 'should return search results');
  
  assert.equal(fakeJira.calls.length, 1, 'should make one API call');
  assert.equal(fakeJira.calls[0].method, 'POST', 'should use POST method');
  assert.equal(fakeJira.calls[0].path, '/rest/api/3/search', 'should call correct endpoint');
  assert.equal(fakeJira.calls[0].body.jql, 'project=TEST AND status=Open', 'should include JQL in body');
  assert.equal(fakeJira.calls[0].body.maxResults, 50, 'should include maxResults');
  assert.equal(fakeJira.calls[0].body.startAt, 0, 'should include startAt');
});

test('jira_search_issues_jql includes fields and expand when provided', async () => {
  const fakeJira = new FakeJiraClient();
  fakeJira.setResponse('/rest/api/3/search', { issues: [], total: 0 });
  
  const server = buildTestServer(fakeJira);
  await callTool(server, 'jira_search_issues_jql', {
    jql: 'project=TEST',
    fields: ['summary', 'status'],
    expand: ['names', 'schema'],
  });
  
  assert.deepEqual(fakeJira.calls[0].body.fields, ['summary', 'status'], 'should include fields array');
  assert.deepEqual(fakeJira.calls[0].body.expand, ['names', 'schema'], 'should include expand array');
});

