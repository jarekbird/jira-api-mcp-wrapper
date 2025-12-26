import dotenv from 'dotenv';
import { JiraMcpServer } from './mcp/server.js';

dotenv.config();

async function main(): Promise<void> {
  const logToStderr = (message: string, data?: unknown) => {
    const line = data ? `${message} ${JSON.stringify(data)}\n` : `${message}\n`;
    process.stderr.write(line);
  };

  logToStderr('jira-api-mcp-wrapper: starting...');
  logToStderr('jira-api-mcp-wrapper: env', {
    JIRA_BASE_URL: process.env.JIRA_BASE_URL ? 'set' : 'not set',
    JIRA_EMAIL: process.env.JIRA_EMAIL ? 'set' : 'not set',
    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN ? 'set' : 'not set',
    JIRA_BEARER_TOKEN: process.env.JIRA_BEARER_TOKEN ? 'set' : 'not set',
  });

  const server = new JiraMcpServer();

  try {
    await server.start();
    logToStderr('jira-api-mcp-wrapper: ready');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logToStderr('jira-api-mcp-wrapper: ERROR failed to start', { error: msg, stack });
    await new Promise((r) => setTimeout(r, 100));
    process.exit(1);
  }
}

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

main().catch(() => process.exit(1));


