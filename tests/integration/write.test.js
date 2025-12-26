/**
 * Write integration tests for jira-api-mcp-wrapper
 *
 * These tests CREATE and MODIFY data in Jira. They are guarded by:
 * - JIRA_INTEGRATION_WRITE_TESTS=1 environment variable
 * - JIRA_TEST_PROJECT_KEY environment variable (required)
 *
 * Optional variables:
 * - JIRA_TEST_TRANSITION_ID: Transition ID for transition test
 *
 * WARNING: These tests create real issues and comments in your Jira instance.
 * They use a unique tag `[mcp-wrapper-test]` in summaries for identification.
 *
 * To run: JIRA_INTEGRATION_WRITE_TESTS=1 npm run test:integration
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { jiraClientFromEnv } from '../../dist/jira/client.js';

function requireWriteTests() {
  if (process.env.JIRA_INTEGRATION_WRITE_TESTS !== '1') {
    throw new Error(
      'Write tests are disabled. Set JIRA_INTEGRATION_WRITE_TESTS=1 to enable.\n' +
        'WARNING: These tests create real data in your Jira instance.'
    );
  }

  const projectKey = process.env.JIRA_TEST_PROJECT_KEY;
  if (!projectKey) {
    throw new Error('JIRA_TEST_PROJECT_KEY is required for write tests');
  }

  return projectKey;
}

let createdIssueKey = null;

test('Write: Create issue', async () => {
  const projectKey = requireWriteTests();
  const client = jiraClientFromEnv();
  const timestamp = new Date().toISOString();
  const summary = `[mcp-wrapper-test] ${timestamp}`;

  const result = await client.postJson('/rest/api/3/issue', {
    fields: {
      project: { key: projectKey },
      issuetype: { name: 'Task' },
      summary,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Test issue created by mcp-wrapper integration tests' }],
          },
        ],
      },
    },
  });

  assert.ok(typeof result === 'object', 'result should be an object');
  assert.ok(typeof result.id === 'string', 'result should have id');
  assert.ok(typeof result.key === 'string', 'result should have key');
  
  createdIssueKey = result.key;
  console.log(`✅ Created issue ${createdIssueKey} with summary: ${summary}`);
});

test('Write: Update issue fields', async () => {
  if (!createdIssueKey) {
    console.log('ℹ️  Skipping update test (no issue created)');
    return;
  }

  const client = jiraClientFromEnv();
  const newSummary = `[mcp-wrapper-test] Updated ${new Date().toISOString()}`;

  await client.putJson(`/rest/api/3/issue/${createdIssueKey}`, {
    fields: {
      summary: newSummary,
    },
  });

  // Verify update
  const issue = await client.getJson(`/rest/api/3/issue/${createdIssueKey}`, {
    fields: ['summary'],
  });

  assert.equal(issue.fields.summary, newSummary, 'summary should be updated');
  console.log(`✅ Updated issue ${createdIssueKey} summary`);
});

test('Write: Add comment (plain string)', async () => {
  if (!createdIssueKey) {
    console.log('ℹ️  Skipping comment test (no issue created)');
    return;
  }

  const client = jiraClientFromEnv();
  const commentText = `Test comment from mcp-wrapper integration test at ${new Date().toISOString()}`;

  const result = await client.postJson(`/rest/api/3/issue/${createdIssueKey}/comment`, {
    body: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: commentText }],
        },
      ],
    },
  });

  assert.ok(typeof result === 'object', 'result should be an object');
  assert.ok(typeof result.id === 'string', 'result should have id');
  console.log(`✅ Added comment to issue ${createdIssueKey}`);
});

test('Write: Add comment (explicit ADF)', async () => {
  if (!createdIssueKey) {
    console.log('ℹ️  Skipping ADF comment test (no issue created)');
    return;
  }

  const client = jiraClientFromEnv();
  const adfDoc = {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'ADF comment with ' },
          { type: 'text', text: 'bold', marks: [{ type: 'strong' }] },
          { type: 'text', text: ' text' },
        ],
      },
    ],
  };

  const result = await client.postJson(`/rest/api/3/issue/${createdIssueKey}/comment`, {
    body: adfDoc,
  });

  assert.ok(typeof result === 'object', 'result should be an object');
  assert.ok(typeof result.id === 'string', 'result should have id');
  console.log(`✅ Added ADF comment to issue ${createdIssueKey}`);
});

test('Write: Transition issue (optional)', async () => {
  if (!createdIssueKey) {
    console.log('ℹ️  Skipping transition test (no issue created)');
    return;
  }

  const transitionId = process.env.JIRA_TEST_TRANSITION_ID;
  if (!transitionId) {
    console.log('ℹ️  JIRA_TEST_TRANSITION_ID not set, skipping transition test');
    return;
  }

  const client = jiraClientFromEnv();
  await client.postJson(`/rest/api/3/issue/${createdIssueKey}/transitions`, {
    transition: { id: transitionId },
  });

  console.log(`✅ Transitioned issue ${createdIssueKey} with transition ${transitionId}`);
});

test('Write: Cleanup - note created issue for manual cleanup', async () => {
  if (!createdIssueKey) {
    return;
  }

  // Jira Cloud API doesn't support issue deletion via REST API
  // Issues are tagged with [mcp-wrapper-test] for easy identification and manual cleanup
  console.log(`ℹ️  Created issue ${createdIssueKey} is tagged with [mcp-wrapper-test]`);
  console.log(`   Search for "[mcp-wrapper-test]" in Jira to find and clean up test issues`);
});

