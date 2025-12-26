/**
 * Contract tests for jira_add_comment tool
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeJiraClient, parseToolText, expectIsError, buildTestServer, callTool } from './helpers.js';

test('jira_add_comment string body is converted to minimal ADF doc', async () => {
  const fakeJira = new FakeJiraClient();
  const mockComment = { id: '12345', body: { type: 'doc', version: 1, content: [] } };
  fakeJira.setResponse('/rest/api/3/issue/TEST-1/comment', mockComment);
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_add_comment', {
    issueKey: 'TEST-1',
    body: 'This is a comment',
    validateAdf: true,
  });
  
  expectIsError(result, false);
  const parsed = parseToolText(result);
  assert.ok(parsed.id !== undefined, 'should return comment with id');
  
  assert.equal(fakeJira.calls.length, 1, 'should make one API call');
  assert.equal(fakeJira.calls[0].method, 'POST', 'should use POST method');
  assert.equal(fakeJira.calls[0].path, '/rest/api/3/issue/TEST-1/comment', 'should call correct endpoint');
  assert.equal(fakeJira.calls[0].body.body.type, 'doc', 'should convert string to ADF doc');
  assert.equal(fakeJira.calls[0].body.body.version, 1, 'should have ADF version');
  assert.ok(Array.isArray(fakeJira.calls[0].body.body.content), 'should have ADF content array');
});

test('jira_add_comment object body is passed through unchanged', async () => {
  const fakeJira = new FakeJiraClient();
  const mockComment = { id: '12345' };
  fakeJira.setResponse('/rest/api/3/issue/TEST-1/comment', mockComment);
  
  const server = buildTestServer(fakeJira);
  const adfBody = {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Comment text' }] }],
  };
  
  await callTool(server, 'jira_add_comment', {
    issueKey: 'TEST-1',
    body: adfBody,
    validateAdf: true,
  });
  
  assert.deepEqual(fakeJira.calls[0].body.body, adfBody, 'should pass through ADF object unchanged');
});

