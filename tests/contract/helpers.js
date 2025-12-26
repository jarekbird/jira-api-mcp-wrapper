/**
 * Contract test helpers for jira-api-mcp-wrapper
 * 
 * These helpers enable testing MCP tool handlers without network calls
 * by using a fake Jira client and parsing tool results.
 */

import { JiraClient } from '../../dist/jira/client.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerJiraTools } from '../../dist/mcp/server.js';

/**
 * Fake Jira client that records all calls for assertions
 */
export class FakeJiraClient {
  constructor() {
    this.calls = [];
    this.responses = new Map(); // path -> response
  }

  async getJson(path, query) {
    this.calls.push({ method: 'GET', path, query });
    if (this.responses.has(path)) {
      return this.responses.get(path);
    }
    return { recorded: true, method: 'GET', path, query };
  }

  async postJson(path, body, query) {
    this.calls.push({ method: 'POST', path, body, query });
    if (this.responses.has(path)) {
      return this.responses.get(path);
    }
    return { recorded: true, method: 'POST', path, body, query };
  }

  async putJson(path, body, query) {
    this.calls.push({ method: 'PUT', path, body, query });
    if (this.responses.has(path)) {
      return this.responses.get(path);
    }
    return { recorded: true, method: 'PUT', path, body, query };
  }

  setResponse(path, response) {
    this.responses.set(path, response);
  }

  reset() {
    this.calls = [];
    this.responses.clear();
  }
}

/**
 * Test server that captures tool handlers
 */
export class TestMcpServer {
  constructor() {
    this.server = new McpServer({ name: 'test', version: '0.1.0' });
    this.toolHandlers = new Map();
    
    // Wrap registerTool to capture handlers
    const originalRegisterTool = this.server.registerTool.bind(this.server);
    this.server.registerTool = (name, schema, handler) => {
      this.toolHandlers.set(name, handler);
      return originalRegisterTool(name, schema, handler);
    };
  }
  
  registerTools(jira) {
    registerJiraTools(this.server, jira);
  }
  
  async callTool(toolName, args) {
    const handler = this.toolHandlers.get(toolName);
    if (!handler) {
      throw new Error(`Tool ${toolName} not found`);
    }
    return await handler(args);
  }
}

/**
 * Build a test server with fake Jira client
 */
export function buildTestServer(fakeJira) {
  const testServer = new TestMcpServer();
  testServer.registerTools(fakeJira);
  return testServer;
}

/**
 * Call a tool by name and arguments
 */
export async function callTool(server, toolName, args) {
  if (server instanceof TestMcpServer) {
    return await server.callTool(toolName, args);
  }
  throw new Error('Server must be a TestMcpServer instance');
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

