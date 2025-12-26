/**
 * Contract tests for jira_list_fields tool
 * 
 * These tests verify the tool handler behavior without making network calls.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeJiraClient, parseToolText, expectIsError, buildTestServer, callTool } from './helpers.js';

test('jira_list_fields calls correct endpoint and returns formatted result', async () => {
  const fakeJira = new FakeJiraClient();
  const mockFields = [
    { id: 'status', name: 'Status', custom: false, searchable: true },
    { id: 'customfield_10001', name: 'Custom Field', custom: true, searchable: false },
  ];
  fakeJira.setResponse('/rest/api/3/field', mockFields);
  
  const server = buildTestServer(fakeJira);
  
  // Call the tool
  const result = await callTool(server, 'jira_list_fields', { query: undefined, includeSchema: false });
  
  // Verify result format
  expectIsError(result, false);
  const parsed = parseToolText(result);
  assert.ok(parsed.count !== undefined, 'result should have count');
  assert.ok(Array.isArray(parsed.fields), 'result should have fields array');
  assert.equal(parsed.count, 2, 'should return correct count');
  
  // Verify Jira client was called correctly
  assert.equal(fakeJira.calls.length, 1, 'should make one API call');
  assert.equal(fakeJira.calls[0].method, 'GET', 'should use GET method');
  assert.equal(fakeJira.calls[0].path, '/rest/api/3/field', 'should call correct endpoint');
});

