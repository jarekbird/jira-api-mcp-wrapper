/**
 * Contract test helpers for jira-api-mcp-wrapper
 * 
 * These helpers enable testing MCP tool handlers without network calls
 * by using a fake Jira client and parsing tool results.
 */

import { JiraClient } from '../../dist/jira/client.js';

/**
 * Fake Jira client that records all calls for assertions
 */
export class FakeJiraClient {
  constructor() {
    this.calls = [];
  }

  async getJson(path, query) {
    this.calls.push({ method: 'GET', path, query });
    return { recorded: true, method: 'GET', path, query };
  }

  async postJson(path, body, query) {
    this.calls.push({ method: 'POST', path, body, query });
    return { recorded: true, method: 'POST', path, body, query };
  }

  async putJson(path, body, query) {
    this.calls.push({ method: 'PUT', path, body, query });
    return { recorded: true, method: 'PUT', path, body, query };
  }

  reset() {
    this.calls = [];
  }
}

/**
 * Parse JSON from tool result text content
 */
export function parseToolText(result) {
  if (!result.content || !result.content[0] || !result.content[0].text) {
    throw new Error('Invalid tool result format: missing content[0].text');
  }
  return JSON.parse(result.content[0].text);
}

/**
 * Assert whether a tool result is an error
 */
export function expectIsError(result, expected) {
  const isError = result.isError === true;
  if (isError !== expected) {
    throw new Error(`Expected isError=${expected}, got ${isError}`);
  }
  return isError;
}

