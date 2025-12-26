/**
 * Contract tests for user search and resolution tools
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeJiraClient, parseToolText, expectIsError, buildTestServer, callTool } from './helpers.js';

test('jira_search_users calls GET with query and maxResults, filters inactive when includeInactive=false', async () => {
  const fakeJira = new FakeJiraClient();
  const mockUsers = [
    { accountId: '1', displayName: 'User One', active: true, emailAddress: 'user1@example.com' },
    { accountId: '2', displayName: 'User Two', active: false, emailAddress: 'user2@example.com' },
  ];
  fakeJira.setResponse('/rest/api/3/user/search', mockUsers);
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_search_users', {
    query: 'user',
    maxResults: 10,
    includeInactive: false,
  });
  
  expectIsError(result, false);
  const parsed = parseToolText(result);
  assert.equal(parsed.count, 1, 'should filter out inactive users');
  assert.equal(parsed.users.length, 1, 'should return only active users');
  assert.equal(parsed.users[0].accountId, '1', 'should return active user');
  
  assert.equal(fakeJira.calls[0].method, 'GET', 'should use GET method');
  assert.equal(fakeJira.calls[0].path, '/rest/api/3/user/search', 'should call correct endpoint');
  assert.equal(fakeJira.calls[0].query.query, 'user', 'should include query param');
  assert.equal(fakeJira.calls[0].query.maxResults, 10, 'should include maxResults');
});

test('jira_resolve_user_account_id returns best match with candidates', async () => {
  const fakeJira = new FakeJiraClient();
  const mockUsers = [
    { accountId: '1', displayName: 'John Doe', active: true, emailAddress: 'john@example.com' },
    { accountId: '2', displayName: 'Jane Smith', active: true, emailAddress: 'jane@example.com' },
  ];
  fakeJira.setResponse('/rest/api/3/user/search', mockUsers);
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_resolve_user_account_id', {
    query: 'john@example.com',
    requireEmailMatch: true,
    includeInactive: false,
  });
  
  expectIsError(result, false);
  const parsed = parseToolText(result);
  assert.equal(parsed.accountId, '1', 'should return exact email match');
  assert.ok(Array.isArray(parsed.candidates), 'should include candidates list');
  assert.equal(parsed.candidates.length, 2, 'should include all candidates');
});

test('jira_resolve_user_account_id returns error when no users found', async () => {
  const fakeJira = new FakeJiraClient();
  fakeJira.setResponse('/rest/api/3/user/search', []);
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_resolve_user_account_id', {
    query: 'nonexistent@example.com',
    requireEmailMatch: false,
    includeInactive: false,
  });
  
  expectIsError(result, true);
  const parsed = parseToolText(result);
  assert.ok(parsed.error.includes('No users found'), 'should return no users found error');
});

