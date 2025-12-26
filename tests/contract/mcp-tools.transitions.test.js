/**
 * Contract tests for jira_get_transitions and jira_transition_issue tools
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeJiraClient, parseToolText, expectIsError, buildTestServer, callTool } from './helpers.js';

test('jira_get_transitions calls GET with issue key and optional expand', async () => {
  const fakeJira = new FakeJiraClient();
  const mockTransitions = { transitions: [{ id: '11', name: 'To Do' }] };
  fakeJira.setResponse('/rest/api/3/issue/TEST-1/transitions', mockTransitions);
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_get_transitions', {
    issueKey: 'TEST-1',
    expand: ['names'],
  });
  
  expectIsError(result, false);
  const parsed = parseToolText(result);
  assert.ok(parsed.transitions !== undefined, 'should return transitions');
  
  assert.equal(fakeJira.calls[0].method, 'GET', 'should use GET method');
  assert.equal(fakeJira.calls[0].path, '/rest/api/3/issue/TEST-1/transitions', 'should call correct endpoint');
  assert.equal(fakeJira.calls[0].query.expand, 'names', 'should include expand query param');
});

test('jira_transition_issue calls POST with transition id and optional fields/update', async () => {
  const fakeJira = new FakeJiraClient();
  fakeJira.setResponse('/rest/api/3/issue/TEST-1/transitions', {});
  
  const server = buildTestServer(fakeJira);
  const result = await callTool(server, 'jira_transition_issue', {
    issueKey: 'TEST-1',
    transitionId: '11',
    fields: { resolution: { name: 'Fixed' } },
  });
  
  expectIsError(result, false);
  const parsed = parseToolText(result);
  assert.equal(parsed.success, true, 'should return success');
  assert.equal(parsed.transitionId, '11', 'should return transition id');
  
  assert.equal(fakeJira.calls[0].method, 'POST', 'should use POST method');
  assert.equal(fakeJira.calls[0].body.transition.id, '11', 'should include transition id in body');
  assert.deepEqual(fakeJira.calls[0].body.fields, { resolution: { name: 'Fixed' } }, 'should include fields in body');
});

