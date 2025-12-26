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

test('jira_list_fields query filter is case-insensitive and matches id or name', async () => {
  const fakeJira = new FakeJiraClient();
  const mockFields = [
    { id: 'status', name: 'Status', custom: false },
    { id: 'customfield_10001', name: 'Custom Field', custom: true },
    { id: 'summary', name: 'Summary', custom: false },
  ];
  fakeJira.setResponse('/rest/api/3/field', mockFields);
  
  const server = buildTestServer(fakeJira);
  
  // Test case-insensitive filter matching id
  const result1 = await callTool(server, 'jira_list_fields', { query: 'STATUS', includeSchema: false });
  const parsed1 = parseToolText(result1);
  assert.equal(parsed1.count, 1, 'should filter by id case-insensitively');
  assert.equal(parsed1.fields[0].id, 'status', 'should match status field');
  
  fakeJira.reset();
  fakeJira.setResponse('/rest/api/3/field', mockFields);
  
  // Test case-insensitive filter matching name
  const result2 = await callTool(server, 'jira_list_fields', { query: 'custom', includeSchema: false });
  const parsed2 = parseToolText(result2);
  assert.equal(parsed2.count, 1, 'should filter by name case-insensitively');
  assert.equal(parsed2.fields[0].id, 'customfield_10001', 'should match custom field');
});

test('jira_list_fields includeSchema=false omits schema; true includes schema', async () => {
  const fakeJira = new FakeJiraClient();
  const mockFields = [
    { id: 'status', name: 'Status', custom: false, schema: { type: 'status', system: 'status' } },
  ];
  fakeJira.setResponse('/rest/api/3/field', mockFields);
  
  const server = buildTestServer(fakeJira);
  
  // Test without schema
  const result1 = await callTool(server, 'jira_list_fields', { query: undefined, includeSchema: false });
  const parsed1 = parseToolText(result1);
  assert.equal(parsed1.fields[0].schema, undefined, 'should omit schema when includeSchema=false');
  
  fakeJira.reset();
  fakeJira.setResponse('/rest/api/3/field', mockFields);
  
  // Test with schema
  const result2 = await callTool(server, 'jira_list_fields', { query: undefined, includeSchema: true });
  const parsed2 = parseToolText(result2);
  assert.ok(parsed2.fields[0].schema !== undefined, 'should include schema when includeSchema=true');
});

test('jira_list_fields JiraHttpError maps to tool error format', async () => {
  const fakeJira = new FakeJiraClient();
  const { JiraHttpError } = await import('../../dist/jira/client.js');
  
  // Make getJson throw a JiraHttpError
  fakeJira.getJson = async () => {
    fakeJira.calls.push({ method: 'GET', path: '/rest/api/3/field' });
    throw new JiraHttpError('Jira GET failed: 500 Internal Server Error', {
      status: 500,
      url: 'https://test.atlassian.net/rest/api/3/field',
      bodyText: 'Internal error',
    });
  };
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_list_fields', { query: undefined, includeSchema: false });
  
  expectIsError(result, true);
  const parsed = parseToolText(result);
  assert.equal(parsed.error, 'Failed to list fields', 'should have error message');
  assert.ok(parsed.extra !== undefined, 'should have extra details');
  assert.equal(parsed.extra.details.status, 500, 'should include HTTP status in details');
});

