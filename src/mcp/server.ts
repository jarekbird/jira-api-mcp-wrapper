import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { JiraClient, JiraHttpError, jiraClientFromEnv } from '../jira/client.js';
import { assertValidAdfDoc, looksLikeAdfDoc } from '../jira/adf.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function toToolResultJson(obj: unknown): ToolResult {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(obj, null, 2),
      },
    ],
  };
}

function toToolError(message: string, extra?: unknown): ToolResult {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ error: message, ...(extra ? { extra } : {}) }, null, 2),
      },
    ],
    isError: true,
  };
}

function normalizeIssueKey(key: string): string {
  return key.trim();
}

function errorToPublicJson(error: unknown): { message: string; details?: unknown } {
  if (error instanceof JiraHttpError) {
    return {
      message: error.message,
      details: {
        status: error.status,
        url: error.url,
        bodyText: error.bodyText,
      },
    };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}

function validateAdfInFields(fields: Record<string, unknown>): void {
  for (const [fieldIdOrName, value] of Object.entries(fields)) {
    if (!looksLikeAdfDoc(value)) continue;
    assertValidAdfDoc(value, fieldIdOrName);
  }
}

export function registerJiraTools(server: McpServer, jira: JiraClient): void {
    server.registerTool(
      'jira_list_fields',
      {
        title: 'Jira: List Fields',
        description:
          'List Jira fields (including customfield_*) from /rest/api/3/field. Use this to map friendly names to field IDs.',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          query: z
            .string()
            .optional()
            .describe('Optional case-insensitive substring filter applied to field name and id'),
          includeSchema: z.boolean().optional().default(false).describe('Include schema metadata if present'),
        } as any,
      },
      async (args: { query?: string; includeSchema: boolean }) => {
        try {
          const fields = await jira.getJson<
            Array<{ id: string; name: string; custom?: boolean; schema?: unknown; searchable?: boolean }>
          >('/rest/api/3/field');
          const q = args.query?.toLowerCase().trim();
          const filtered = q
            ? fields.filter((f) => f.id.toLowerCase().includes(q) || f.name.toLowerCase().includes(q))
            : fields;
          const shaped = filtered.map((f) => ({
            id: f.id,
            name: f.name,
            custom: f.custom ?? undefined,
            searchable: f.searchable ?? undefined,
            ...(args.includeSchema ? { schema: f.schema ?? undefined } : {}),
          }));
          return toToolResultJson({ count: shaped.length, fields: shaped });
        } catch (error) {
          return toToolError('Failed to list fields', errorToPublicJson(error));
        }
      }
    );

    server.registerTool(
      'jira_get_issue',
      {
        title: 'Jira: Get Issue',
        description:
          'Fetch a Jira issue by key using /rest/api/3/issue/{key}. You can request specific fields/expand to reduce payload.',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          issueKey: z.string().describe('Issue key, e.g. WOR-2367'),
          fields: z.array(z.string()).optional().describe('Optional list of fields (names or IDs) to include'),
          expand: z
            .array(z.string())
            .optional()
            .describe('Optional expand list, e.g. ["names","schema","renderedFields","operations"]'),
        } as any,
      },
      async (args: { issueKey: string; fields?: string[]; expand?: string[] }) => {
        try {
          const issueKey = normalizeIssueKey(args.issueKey);
          const query: Record<string, string | undefined> = {};
          if (args.fields?.length) query.fields = args.fields.join(',');
          if (args.expand?.length) query.expand = args.expand.join(',');
          const issue = await jira.getJson<unknown>(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, query);
          return toToolResultJson(issue);
        } catch (error) {
          return toToolError('Failed to get issue', errorToPublicJson(error));
        }
      }
    );

    server.registerTool(
      'jira_update_issue_fields',
      {
        title: 'Jira: Update Issue Fields',
        description:
          'Update Jira issue fields via /rest/api/3/issue/{key} PUT. Supports customfield_* and ADF docs. You must send correct field IDs and value shapes (e.g. user picker needs accountId).',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          issueKey: z.string().describe('Issue key, e.g. WOR-2367'),
          fields: z.record(z.unknown()).describe('Fields object to set (e.g. { "customfield_10246": { accountId: "..." } })'),
          update: z
            .record(z.unknown())
            .optional()
            .describe('Optional Jira "update" object for advanced updates'),
          notifyUsers: z.boolean().optional().default(false).describe('Whether to notify users (Jira notifyUsers query param)'),
          overrideScreenSecurity: z
            .boolean()
            .optional()
            .default(false)
            .describe('Attempt to override screen security (if permitted)'),
          overrideEditableFlag: z
            .boolean()
            .optional()
            .default(false)
            .describe('Attempt to override editable flag (if permitted)'),
          validateAdf: z
            .boolean()
            .optional()
            .default(true)
            .describe('If true, validates any ADF-like objects contain type/version/content'),
        } as any,
      },
      async (args: {
        issueKey: string;
        fields: Record<string, unknown>;
        update?: Record<string, unknown>;
        notifyUsers: boolean;
        overrideScreenSecurity: boolean;
        overrideEditableFlag: boolean;
        validateAdf: boolean;
      }) => {
        try {
          const issueKey = normalizeIssueKey(args.issueKey);
          if (args.validateAdf) validateAdfInFields(args.fields);

          const body: Record<string, unknown> = { fields: args.fields };
          if (args.update) body.update = args.update;

          await jira.putJson(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, body, {
            notifyUsers: args.notifyUsers,
            overrideScreenSecurity: args.overrideScreenSecurity,
            overrideEditableFlag: args.overrideEditableFlag,
          });

          return toToolResultJson({ success: true, issueKey });
        } catch (error) {
          return toToolError('Failed to update issue', errorToPublicJson(error));
        }
      }
    );

    server.registerTool(
      'jira_search_issues_jql',
      {
        title: 'Jira: Search Issues (JQL)',
        description:
          'Search issues using JQL via /rest/api/3/search. Returns a page of issues with selected fields.',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          jql: z.string().describe('JQL query (e.g. project=WOR AND key=WOR-2367)'),
          maxResults: z.number().int().min(1).max(100).optional().default(50).describe('Max results (1-100)'),
          startAt: z.number().int().min(0).optional().default(0).describe('Pagination start offset'),
          fields: z.array(z.string()).optional().describe('Optional list of fields (names or IDs) to include'),
          expand: z.array(z.string()).optional().describe('Optional expand list'),
        } as any,
      },
      async (args: {
        jql: string;
        maxResults: number;
        startAt: number;
        fields?: string[];
        expand?: string[];
      }) => {
        try {
          const body: Record<string, unknown> = {
            jql: args.jql,
            maxResults: args.maxResults,
            startAt: args.startAt,
          };
          if (args.fields?.length) body.fields = args.fields;
          if (args.expand?.length) body.expand = args.expand;

          const result = await jira.postJson<unknown>('/rest/api/3/search', body);
          return toToolResultJson(result);
        } catch (error) {
          return toToolError('Failed to search issues (JQL)', errorToPublicJson(error));
        }
      }
    );

    server.registerTool(
      'jira_create_issue',
      {
        title: 'Jira: Create Issue',
        description:
          'Create an issue via /rest/api/3/issue. Supply fields including project + issuetype and any customfield_* values (including ADF docs).',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          fields: z.record(z.unknown()).describe('Issue fields for creation (must include project and issuetype)'),
          validateAdf: z
            .boolean()
            .optional()
            .default(true)
            .describe('If true, validates any ADF-like objects contain type/version/content'),
        } as any,
      },
      async (args: { fields: Record<string, unknown>; validateAdf: boolean }) => {
        try {
          if (args.validateAdf) validateAdfInFields(args.fields);
          const result = await jira.postJson<unknown>('/rest/api/3/issue', { fields: args.fields });
          return toToolResultJson(result);
        } catch (error) {
          return toToolError('Failed to create issue', errorToPublicJson(error));
        }
      }
    );

    server.registerTool(
      'jira_add_comment',
      {
        title: 'Jira: Add Comment',
        description:
          'Add a comment to an issue via /rest/api/3/issue/{key}/comment. Body may be plain string or ADF doc object.',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          issueKey: z.string().describe('Issue key, e.g. WOR-2367'),
          body: z
            .union([z.string(), z.record(z.unknown())])
            .describe('Comment body: plain text string or ADF doc object'),
          validateAdf: z
            .boolean()
            .optional()
            .default(true)
            .describe('If true and body is object-like, validate it as an ADF doc'),
        } as any,
      },
      async (args: { issueKey: string; body: string | Record<string, unknown>; validateAdf: boolean }) => {
        try {
          const issueKey = normalizeIssueKey(args.issueKey);
          const commentBody =
            typeof args.body === 'string'
              ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: args.body }] }] }
              : args.body;

          if (args.validateAdf && typeof commentBody === 'object') assertValidAdfDoc(commentBody, 'comment.body');

          const result = await jira.postJson<unknown>(
            `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
            { body: commentBody }
          );
          return toToolResultJson(result);
        } catch (error) {
          return toToolError('Failed to add comment', errorToPublicJson(error));
        }
      }
    );

    server.registerTool(
      'jira_get_transitions',
      {
        title: 'Jira: Get Transitions',
        description: 'Get available transitions for an issue via /rest/api/3/issue/{key}/transitions.',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          issueKey: z.string().describe('Issue key, e.g. WOR-2367'),
          expand: z.array(z.string()).optional().describe('Optional expand list'),
        } as any,
      },
      async (args: { issueKey: string; expand?: string[] }) => {
        try {
          const issueKey = normalizeIssueKey(args.issueKey);
          const query: Record<string, string | undefined> = {};
          if (args.expand?.length) query.expand = args.expand.join(',');
          const result = await jira.getJson<unknown>(
            `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
            query
          );
          return toToolResultJson(result);
        } catch (error) {
          return toToolError('Failed to get transitions', errorToPublicJson(error));
        }
      }
    );

    server.registerTool(
      'jira_transition_issue',
      {
        title: 'Jira: Transition Issue',
        description:
          'Transition an issue via /rest/api/3/issue/{key}/transitions. Provide a transition id (use jira_get_transitions first).',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          issueKey: z.string().describe('Issue key, e.g. WOR-2367'),
          transitionId: z.string().describe('Transition id to apply'),
          fields: z.record(z.unknown()).optional().describe('Optional fields to set during transition'),
          update: z.record(z.unknown()).optional().describe('Optional update object to apply during transition'),
        } as any,
      },
      async (args: {
        issueKey: string;
        transitionId: string;
        fields?: Record<string, unknown>;
        update?: Record<string, unknown>;
      }) => {
        try {
          const issueKey = normalizeIssueKey(args.issueKey);
          const body: Record<string, unknown> = { transition: { id: args.transitionId } };
          if (args.fields) body.fields = args.fields;
          if (args.update) body.update = args.update;

          await jira.postJson(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, body);
          return toToolResultJson({ success: true, issueKey, transitionId: args.transitionId });
        } catch (error) {
          return toToolError('Failed to transition issue', errorToPublicJson(error));
        }
      }
    );

    server.registerTool(
      'jira_bulk_create_issues',
      {
        title: 'Jira: Bulk Create Issues',
        description:
          'Bulk create issues via POST /rest/api/3/issue/bulk. Provide issueUpdates entries containing fields (and optional update).',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          issueUpdates: z
            .array(
              z.object({
                fields: z.record(z.unknown()).describe('Issue fields for creation'),
                update: z.record(z.unknown()).optional().describe('Optional Jira update object for creation'),
              })
            )
            .min(1)
            .max(50)
            .describe('Issues to create (Jira Cloud limit is typically 50 per request)'),
          validateAdf: z
            .boolean()
            .optional()
            .default(true)
            .describe('If true, validates any ADF-like objects inside each issue fields object'),
        } as any,
      },
      async (args: {
        issueUpdates: Array<{ fields: Record<string, unknown>; update?: Record<string, unknown> }>;
        validateAdf: boolean;
      }) => {
        try {
          if (args.validateAdf) {
            for (const [idx, u] of args.issueUpdates.entries()) {
              try {
                validateAdfInFields(u.fields);
              } catch (e) {
                return toToolError(`ADF validation failed for issueUpdates[${idx}].fields`, errorToPublicJson(e));
              }
            }
          }

          const result = await jira.postJson<unknown>('/rest/api/3/issue/bulk', {
            issueUpdates: args.issueUpdates,
          });
          return toToolResultJson(result);
        } catch (error) {
          return toToolError('Failed to bulk create issues', errorToPublicJson(error));
        }
      }
    );

    server.registerTool(
      'jira_bulk_get_editable_fields',
      {
        title: 'Jira: Bulk Get Editable Fields',
        description:
          'Get bulk-editable field IDs for a set of issues via GET /rest/api/3/bulk/issues/fields. Use the returned field IDs in selectedActions for jira_bulk_edit_issues.',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          issueIdsOrKeys: z
            .array(z.string())
            .min(1)
            .max(1000)
            .describe('Issue IDs or keys to calculate bulk-editable fields for'),
          searchText: z.string().optional().describe('Optional search text filter'),
          startingAfter: z.string().optional().describe('Pagination cursor'),
          endingBefore: z.string().optional().describe('Pagination cursor'),
        } as any,
      },
      async (args: {
        issueIdsOrKeys: string[];
        searchText?: string;
        startingAfter?: string;
        endingBefore?: string;
      }) => {
        try {
          const result = await jira.getJson<unknown>('/rest/api/3/bulk/issues/fields', {
            issueIdsOrKeys: args.issueIdsOrKeys.join(','),
            searchText: args.searchText,
            startingAfter: args.startingAfter,
            endingBefore: args.endingBefore,
          });
          return toToolResultJson(result);
        } catch (error) {
          return toToolError('Failed to get bulk editable fields', errorToPublicJson(error));
        }
      }
    );

    server.registerTool(
      'jira_bulk_edit_issues',
      {
        title: 'Jira: Bulk Edit Issues',
        description:
          'Bulk edit issues via POST /rest/api/3/bulk/issues/fields. You must provide selectedIssueIdsOrKeys, selectedActions (field IDs), and editedFieldsInput.',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          selectedIssueIdsOrKeys: z
            .array(z.string())
            .min(1)
            .max(1000)
            .describe('Issue IDs or keys to bulk edit (Jira limit is typically 1000)'),
          selectedActions: z
            .array(z.string())
            .min(1)
            .max(200)
            .describe(
              'Field IDs to be bulk edited (use jira_bulk_get_editable_fields to discover field IDs for your selected issues)'
            ),
          editedFieldsInput: z
            .record(z.unknown())
            .describe('Object containing the new field values (must align to selectedActions)'),
          sendBulkNotification: z
            .boolean()
            .optional()
            .default(true)
            .describe('Whether Jira should send a bulk change notification email'),
          validateAdf: z
            .boolean()
            .optional()
            .default(true)
            .describe('If true, validates any ADF-like objects inside editedFieldsInput'),
        } as any,
      },
      async (args: {
        selectedIssueIdsOrKeys: string[];
        selectedActions: string[];
        editedFieldsInput: Record<string, unknown>;
        sendBulkNotification: boolean;
        validateAdf: boolean;
      }) => {
        try {
          if (args.validateAdf) validateAdfInFields(args.editedFieldsInput);

          const payload = {
            selectedIssueIdsOrKeys: args.selectedIssueIdsOrKeys,
            selectedActions: args.selectedActions,
            editedFieldsInput: args.editedFieldsInput,
            sendBulkNotification: args.sendBulkNotification,
          };

          const result = await jira.postJson<unknown>('/rest/api/3/bulk/issues/fields', payload);
          return toToolResultJson(result);
        } catch (error) {
          return toToolError('Failed to bulk edit issues', errorToPublicJson(error));
        }
      }
    );

    server.registerTool(
      'jira_search_users',
      {
        title: 'Jira: Search Users',
        description:
          'Search users (returns accountId) using /rest/api/3/user/search. Use this to map email/displayName → accountId for user picker fields.',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          query: z.string().describe('Search query (email or name)'),
          maxResults: z.number().int().min(1).max(50).optional().default(10).describe('Max results (1-50)'),
          includeInactive: z
            .boolean()
            .optional()
            .default(false)
            .describe('If true, do not filter out inactive users client-side'),
        } as any,
      },
      async (args: { query: string; maxResults: number; includeInactive: boolean }) => {
        try {
          const users = await jira.getJson<
            Array<{
              accountId: string;
              displayName?: string;
              active?: boolean;
              emailAddress?: string;
            }>
          >('/rest/api/3/user/search', { query: args.query, maxResults: args.maxResults });

          const filtered = args.includeInactive ? users : users.filter((u) => u.active !== false);
          const shaped = filtered.map((u) => ({
            accountId: u.accountId,
            displayName: u.displayName,
            active: u.active,
            emailAddress: u.emailAddress,
          }));

          return toToolResultJson({ count: shaped.length, users: shaped });
        } catch (error) {
          return toToolError('Failed to search users', errorToPublicJson(error));
        }
      }
    );

    server.registerTool(
      'jira_resolve_user_account_id',
      {
        title: 'Jira: Resolve User AccountId',
        description:
          'Resolve a single best-match Jira user and return accountId (for setting user picker custom fields). Uses /rest/api/3/user/search and selects the best candidate.',
        // Cast to avoid TS "excessively deep" instantiation issues from SDK generics + Zod types.
        inputSchema: {
          query: z.string().describe('Email or name to resolve'),
          requireEmailMatch: z
            .boolean()
            .optional()
            .default(false)
            .describe('If true, prefers exact email match when emailAddress is present'),
          includeInactive: z.boolean().optional().default(false).describe('If true, allow inactive users'),
        } as any,
      },
      async (args: { query: string; requireEmailMatch: boolean; includeInactive: boolean }) => {
        try {
          const users = await jira.getJson<
            Array<{
              accountId: string;
              displayName?: string;
              active?: boolean;
              emailAddress?: string;
            }>
          >('/rest/api/3/user/search', { query: args.query, maxResults: 20 });

          const candidates = args.includeInactive ? users : users.filter((u) => u.active !== false);
          if (candidates.length === 0) return toToolError('No users found for query', { query: args.query });

          const q = args.query.toLowerCase().trim();
          const emailExact = candidates.find((u) => u.emailAddress?.toLowerCase() === q);
          if (args.requireEmailMatch && !emailExact) {
            return toToolError('No exact email match found (email visibility may be restricted in your Jira)', {
              query: args.query,
              hint: 'Try resolving by display name, or use the candidates list from jira_search_users to pick an accountId.',
            });
          }
          const chosen = emailExact ?? candidates[0];

          return toToolResultJson({
            accountId: chosen.accountId,
            displayName: chosen.displayName,
            active: chosen.active,
            emailAddress: chosen.emailAddress,
            candidates: candidates.slice(0, 10).map((u) => ({
              accountId: u.accountId,
              displayName: u.displayName,
              active: u.active,
              emailAddress: u.emailAddress,
            })),
          });
        } catch (error) {
          return toToolError('Failed to resolve user', errorToPublicJson(error));
        }
      }
    );
}

export class JiraMcpServer {
  private server: McpServer;
  private transport: StdioServerTransport;
  private jira: JiraClient;

  constructor() {
    this.server = new McpServer({ name: 'jira-api-mcp-wrapper', version: '0.1.0' });
    this.transport = new StdioServerTransport();
    this.jira = jiraClientFromEnv();
    registerJiraTools(this.server, this.jira);
  }

  async start(): Promise<void> {
    await this.server.connect(this.transport);
  }
}


