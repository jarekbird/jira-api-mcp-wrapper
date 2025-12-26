export type JiraAuthConfig =
  | { type: 'basic'; email: string; apiToken: string }
  | { type: 'bearer'; token: string };

export interface JiraClientConfig {
  baseUrl: string;
  auth: JiraAuthConfig;
  timeoutMs?: number;
}

export class JiraHttpError extends Error {
  public status: number;
  public url: string;
  public bodyText?: string;

  constructor(message: string, opts: { status: number; url: string; bodyText?: string }) {
    super(message);
    this.name = 'JiraHttpError';
    this.status = opts.status;
    this.url = opts.url;
    this.bodyText = opts.bodyText;
  }
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    throw new Error('JIRA_BASE_URL must start with http:// or https:// (e.g. https://your-domain.atlassian.net)');
  }
  return trimmed;
}

function buildAuthHeader(auth: JiraAuthConfig): string {
  if (auth.type === 'bearer') return `Bearer ${auth.token}`;
  const token = Buffer.from(`${auth.email}:${auth.apiToken}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

async function readBodyTextSafely(res: Response): Promise<string | undefined> {
  try {
    const text = await res.text();
    return text.length > 20_000 ? `${text.slice(0, 20_000)}…(truncated)` : text;
  } catch {
    return undefined;
  }
}

export class JiraClient {
  private config: JiraClientConfig;

  constructor(config: JiraClientConfig) {
    this.config = { ...config, baseUrl: normalizeBaseUrl(config.baseUrl), timeoutMs: config.timeoutMs ?? 30_000 };
  }

  private url(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(this.config.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  async getJson<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = this.url(path, query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: buildAuthHeader(this.config.auth),
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        const bodyText = await readBodyTextSafely(res);
        throw new JiraHttpError(`Jira GET failed: ${res.status} ${res.statusText}`, { status: res.status, url, bodyText });
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async putJson<TResponse = unknown>(
    path: string,
    body: unknown,
    query?: Record<string, string | number | boolean | undefined>
  ): Promise<TResponse> {
    const url = this.url(path, query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: buildAuthHeader(this.config.auth),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // Jira issue edit often returns 204 No Content.
      if (res.status === 204) return {} as TResponse;

      if (!res.ok) {
        const bodyText = await readBodyTextSafely(res);
        throw new JiraHttpError(`Jira PUT failed: ${res.status} ${res.statusText}`, { status: res.status, url, bodyText });
      }

      // Some endpoints return JSON even on success.
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return (await res.json()) as TResponse;
      return {} as TResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  async postJson<TResponse = unknown>(
    path: string,
    body: unknown,
    query?: Record<string, string | number | boolean | undefined>
  ): Promise<TResponse> {
    const url = this.url(path, query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: buildAuthHeader(this.config.auth),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // Some Jira endpoints return 204 No Content.
      if (res.status === 204) return {} as TResponse;

      if (!res.ok) {
        const bodyText = await readBodyTextSafely(res);
        throw new JiraHttpError(`Jira POST failed: ${res.status} ${res.statusText}`, {
          status: res.status,
          url,
          bodyText,
        });
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return (await res.json()) as TResponse;
      return {} as TResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function jiraClientFromEnv(): JiraClient {
  const baseUrl = process.env.JIRA_BASE_URL;
  if (!baseUrl) throw new Error('Missing required env var: JIRA_BASE_URL');

  const bearer = process.env.JIRA_BEARER_TOKEN;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (bearer) {
    return new JiraClient({ baseUrl, auth: { type: 'bearer', token: bearer } });
  }

  if (!email || !apiToken) {
    throw new Error('Missing auth env vars: set either JIRA_BEARER_TOKEN or (JIRA_EMAIL + JIRA_API_TOKEN)');
  }

  return new JiraClient({ baseUrl, auth: { type: 'basic', email, apiToken } });
}


