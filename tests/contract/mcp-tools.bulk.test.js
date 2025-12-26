/**
 * Contract tests for bulk operations tools
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeJiraClient, parseToolText, expectIsError, buildTestServer, callTool } from './helpers.js';

test('jira_bulk_create_issues calls POST /rest/api/3/issue/bulk with issueUpdates', async () => {
  const fakeJira = new FakeJiraClient();
  const mockResult = { issues: [{ id: '12345', key: 'TEST-1' }] };
  fakeJira.setResponse('/rest/api/3/issue/bulk', mockResult);
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_bulk_create_issues', {
    issueUpdates: [
      { fields: { project: { key: 'TEST' }, issuetype: { name: 'Task' }, summary: 'Issue 1' } },
      { fields: { project: { key: 'TEST' }, issuetype: { name: 'Task' }, summary: 'Issue 2' } },
    ],
    validateAdf: true,
  });
  
  expectIsError(result, false);
  const parsed = parseToolText(result);
  assert.ok(parsed.issues !== undefined, 'should return created issues');
  
  assert.equal(fakeJira.calls[0].method, 'POST', 'should use POST method');
  assert.equal(fakeJira.calls[0].path, '/rest/api/3/issue/bulk', 'should call correct endpoint');
  assert.equal(fakeJira.calls[0].body.issueUpdates.length, 2, 'should include all issue updates');
});

test('jira_bulk_get_editable_fields calls GET with comma-joined issueIdsOrKeys', async () => {
  const fakeJira = new FakeJiraClient();
  fakeJira.setResponse('/rest/api/3/bulk/issues/fields', { fields: [] });
  
  const server = buildTestServer(fakeJira);
  await callTool(server, 'jira_bulk_get_editable_fields', {
    issueIdsOrKeys: ['TEST-1', 'TEST-2'],
    searchText: 'summary',
  });
  
  assert.equal(fakeJira.calls[0].method, 'GET', 'should use GET method');
  assert.equal(fakeJira.calls[0].path, '/rest/api/3/bulk/issues/fields', 'should call correct endpoint');
  assert.equal(fakeJira.calls[0].query.issueIdsOrKeys, 'TEST-1,TEST-2', 'should join issue keys with comma');
  assert.equal(fakeJira.calls[0].query.searchText, 'summary', 'should include searchText');
});

test('jira_bulk_edit_issues calls POST with selectedIssueIdsOrKeys, selectedActions, editedFieldsInput', async () => {
  const fakeJira = new FakeJiraClient();
  fakeJira.setResponse('/rest/api/3/bulk/issues/fields', { taskId: '12345' });
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_bulk_edit_issues', {
    selectedIssueIdsOrKeys: ['TEST-1', 'TEST-2'],
    selectedActions: ['summary', 'description'],
    editedFieldsInput: { summary: 'Updated Summary' },
    sendBulkNotification: false,
    validateAdf: true,
  });
  
  expectIsError(result, false);
  const parsed = parseToolText(result);
  assert.ok(parsed.taskId !== undefined, 'should return task id');
  
  assert.equal(fakeJira.calls[0].method, 'POST', 'should use POST method');
  assert.deepEqual(fakeJira.calls[0].body.selectedIssueIdsOrKeys, ['TEST-1', 'TEST-2'], 'should include selected issues');
  assert.deepEqual(fakeJira.calls[0].body.selectedActions, ['summary', 'description'], 'should include selected actions');
  assert.deepEqual(fakeJira.calls[0].body.editedFieldsInput, { summary: 'Updated Summary' }, 'should include edited fields');
  assert.equal(fakeJira.calls[0].body.sendBulkNotification, false, 'should include notification flag');
});

