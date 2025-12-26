# jira-api-mcp-wrapper

An **MCP server (stdio)** that talks directly to **Jira Cloud REST API v3** using **static credentials** (no OAuth flow) and exposes a small set of deterministic tools for:

- discovering `customfield_*` IDs
- resolving `accountId` for user picker fields
- updating issue fields (including **ADF JSON**)

## Testing

### Running Tests

**Unit and Contract Tests (default, no network):**
```bash
npm test
```

This runs all unit tests and contract tests without making any network calls. These tests use mocked HTTP clients and are deterministic.

**Integration Tests (requires Jira credentials):**

Integration tests make real HTTP calls to Jira Cloud. They are split into read-only (smoke) and write tests.

**Read-only smoke tests:**
```bash
npm run test:integration:smoke
```

Requires:
- `JIRA_BASE_URL` (or `JIRA_URL`)
- `JIRA_EMAIL` and `JIRA_API_TOKEN`, OR `JIRA_BEARER_TOKEN`

Optional variables:
- `JIRA_TEST_USER_QUERY`: User search query
- `JIRA_TEST_JQL`: JQL query for search test
- `JIRA_TEST_ISSUE_KEY`: Issue key for get/transitions tests

**Write tests (creates real data):**
```bash
JIRA_INTEGRATION_WRITE_TESTS=1 npm run test:integration:write
```

Requires:
- All smoke test variables
- `JIRA_TEST_PROJECT_KEY`: Project key for creating test issues
- `JIRA_TEST_TRANSITION_ID` (optional): Transition ID for transition test

⚠️ **Warning**: Write tests create real issues and comments in your Jira instance. They use the tag `[mcp-wrapper-test]` in summaries for easy identification and cleanup.

**All integration tests:**
```bash
npm run test:integration
```

### Test Structure

- `tests/unit/`: Unit tests for individual components (no network)
- `tests/contract/`: Contract tests for MCP tool handlers (no network, uses fake Jira client)
- `tests/integration/smoke.test.js`: Read-only integration tests
- `tests/integration/write.test.js`: Write integration tests (guarded by env var)

## Configuration

Set environment variables (pick one auth method):

### Mapping from `ga-jira/mcp.json`

- `JIRA_URL` → **`JIRA_BASE_URL`** (same value)
- `JIRA_EMAIL` → `JIRA_EMAIL`
- `JIRA_API_TOKEN` → `JIRA_API_TOKEN`

### Option A: Basic auth (Jira Cloud email + API token)

- `JIRA_BASE_URL` (example: `https://your-domain.atlassian.net`)
- `JIRA_EMAIL` (example: `you@company.com`)
- `JIRA_API_TOKEN` (create in Atlassian account settings)

### Option B: Bearer token

- `JIRA_BASE_URL`
- `JIRA_BEARER_TOKEN`

## Cursor MCP config example

Add to your Cursor MCP config (typically `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "jira-api-mcp-wrapper": {
      "command": "node",
      "args": [
        "/path/to/jira-api-mcp-wrapper/dist/index.js"
      ],
      "env": {
        "JIRA_BASE_URL": "https://your-domain.atlassian.net",
        "JIRA_EMAIL": "you@company.com",
        "JIRA_API_TOKEN": "your_api_token"
      }
    }
  }
}
```

## Tools

### `jira_list_fields`

Lists Jira fields (including `customfield_*`) via `/rest/api/3/field`.

### `jira_search_issues_jql`

Search issues using JQL via `/rest/api/3/search`.

### `jira_create_issue`

Create an issue via `/rest/api/3/issue` (provide `fields` including `project` + `issuetype` + `summary`, plus any `customfield_*`).

### `jira_search_users`

Searches users and returns `accountId` candidates via `/rest/api/3/user/search`.

### `jira_resolve_user_account_id`

Resolves a best-match user and returns the chosen `accountId` (useful for user picker custom fields).

### `jira_get_issue`

Fetches an issue via `/rest/api/3/issue/{key}`.

### `jira_update_issue_fields`

Updates issue fields via `/rest/api/3/issue/{key}` `PUT`.

- Supports `customfield_*` updates
- Supports sending raw **ADF JSON** for ADF-backed fields (e.g., `description` and some multi-line custom fields)
- Includes optional flags:
  - `notifyUsers`
  - `overrideScreenSecurity`
  - `overrideEditableFlag`
  - `validateAdf` (default true)

### `jira_add_comment`

Add a comment via `/rest/api/3/issue/{key}/comment` (wrapper accepts plain text or ADF doc).

### `jira_get_transitions`

List available transitions via `/rest/api/3/issue/{key}/transitions`.

### `jira_transition_issue`

Apply a transition via `/rest/api/3/issue/{key}/transitions` (use `jira_get_transitions` to find `transitionId`).

### `jira_bulk_create_issues`

Bulk create issues via `POST /rest/api/3/issue/bulk`.

Input is an array of `issueUpdates` entries, each with:
- `fields`: issue creation fields (must include `project`, `issuetype`, `summary`, etc.)
- `update` (optional): Jira update object

### `jira_bulk_get_editable_fields`

Get the **bulk-editable field IDs** for a set of issues via `GET /rest/api/3/bulk/issues/fields`.

Use the returned field IDs as `selectedActions` for `jira_bulk_edit_issues`.

### `jira_bulk_edit_issues`

Bulk edit issues via `POST /rest/api/3/bulk/issues/fields`.

Requires:
- `selectedIssueIdsOrKeys`: issue IDs or keys to edit
- `selectedActions`: field IDs to edit (use `jira_bulk_get_editable_fields`)
- `editedFieldsInput`: object containing values to apply (must align with `selectedActions`)

## Practical examples

### Set a user picker field (e.g. `customfield_10246`)

1) Resolve accountId:

- call `jira_resolve_user_account_id` with `query="you@company.com"`

2) Update the issue:

- call `jira_update_issue_fields` with:
  - `issueKey="WOR-2367"`
  - `fields={ "customfield_10246": { "accountId": "<accountId>" } }`

### Set an ADF field

If your local record already stores ADF JSON, send it directly as the field value (must include `type:"doc"`, `version`, and `content`).

## Notes / caveats

- Jira Cloud frequently **does not expose email addresses** in API responses depending on org privacy settings. This wrapper supports resolving by display name as a fallback.
- For many “people picker” fields, Jira Cloud expects `accountId` (not email).


