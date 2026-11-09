/**
 * Everything this server needs from aigifmaker.ai: submit a GIF, read its
 * status, read the credit balance. Plain fetch against the public API with the
 * caller's own key, so a GIF made here is priced and stored exactly like one
 * made on the website.
 *
 * Every response is HTTP 200; the JSON `code` tells success (0) from refusal.
 */

export const SITE_URL = 'https://aigifmaker.ai';
export const KEYS_URL = 'https://aigifmaker.ai/settings/apikeys';
export const PRICING_URL = 'https://aigifmaker.ai/pricing';

/** Overridable for testing against a local build of the site; never needed in use. */
export function baseUrl(): string {
  return process.env.AIGIFMAKER_BASE_URL?.replace(/\/$/, '') || SITE_URL;
}

export const credentialsHint = `Set AIGIFMAKER_API_KEY to run on your own AI GIF Maker credits: create a key at ${KEYS_URL}`;

export type ErrorKind = 'auth' | 'quota' | 'rejected' | 'failed' | 'timeout' | 'network' | 'other';

export class AigifmakerError extends Error {
  constructor(
    message: string,
    readonly kind: ErrorKind = 'other',
    readonly code?: number
  ) {
    super(message);
    this.name = 'AigifmakerError';
  }
}

export type Task = {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'canceled' | string;
  images?: string[];
  watermarked?: boolean[];
  queued?: boolean;
  queueEta?: number;
  errorMessage?: string;
  failureKind?: string;
  refundNote?: string;
};

function apiKey(): string | undefined {
  return process.env.AIGIFMAKER_API_KEY?.trim() || undefined;
}

export function hasApiKey(): boolean {
  return Boolean(apiKey());
}

type FetchLike = typeof fetch;
let fetchImpl: FetchLike = (...args) => fetch(...args);

/** Tests swap the transport; nothing else should. */
export function setFetch(f: FetchLike): void {
  fetchImpl = f;
}

/** Turn an API envelope into `data`, or throw the error that says what to do next. */
export function unwrap(body: any): any {
  const code = body?.code;
  const data = body?.data && typeof body.data === 'object' ? body.data : {};
  if (code === 0) {
    if (data.wall) throw new AigifmakerError(`An API key is required. ${credentialsHint}`, 'auth', 0);
    return data;
  }
  const msg = String(body?.message ?? body?.error ?? 'unexpected response');
  const n = typeof code === 'number' ? code : undefined;
  if (/invalid api key|no auth/i.test(msg)) throw new AigifmakerError(msg, 'auth', n);
  if (/insufficient credits/i.test(msg)) throw new AigifmakerError(`${msg}. Top up at ${PRICING_URL}`, 'quota', n);
  if (n !== undefined && n !== -1) throw new AigifmakerError(msg, 'rejected', n);
  throw new AigifmakerError(msg, 'other', n);
}

async function post(path: string, body: unknown = {}): Promise<any> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'aigifmaker-mcp/0.1.1',
  };
  const key = apiKey();
  if (key) headers.authorization = `Bearer ${key}`;
  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl()}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (e) {
    throw new AigifmakerError(`Could not reach aigifmaker.ai: ${(e as Error).message}`, 'network');
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new AigifmakerError(`aigifmaker.ai returned a non-JSON response (HTTP ${res.status})`);
  }
  return unwrap(json);
}

/** Start one GIF; resolves to the task id. The body is fixed except for `prompt`. */
export async function submit(prompt: string): Promise<string> {
  const data = await post('/api/ai/generate', {
    provider: 'openlux',
    mediaType: 'image',
    model: 'gif-maker-v1',
    scene: 'text-to-image',
    prompt,
    options: { output_format: 'gif' },
  });
  if (!data?.id) throw new AigifmakerError('the service returned no task id');
  return String(data.id);
}

export async function getStatus(id: string): Promise<Task> {
  return (await post('/api/ai/query', { taskId: id })) as Task;
}

export async function credits(): Promise<number> {
  const data = await post('/api/user/get-user-credits');
  return Number(data?.remainingCredits ?? 0);
}

/** Poll every 3 seconds until the GIF is ready; resolves to its URL. */
export async function waitFor(id: string, { timeoutMs = 5 * 60_000, intervalMs = 3_000 } = {}): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let task: Task;
    try {
      task = await getStatus(id);
    } catch (e) {
      // A dropped poll is not a failed generation: keep waiting.
      if (e instanceof AigifmakerError && e.kind === 'network') task = { status: 'processing' } as Task;
      else throw e;
    }
    if (task.status === 'success' && task.images?.length) return String(task.images[0]);
    if (task.status === 'failed' || task.status === 'canceled') {
      const msg = task.errorMessage || `The GIF ${task.status}.`;
      throw new AigifmakerError(msg, task.failureKind === 'moderation' ? 'rejected' : 'failed');
    }
    if (Date.now() + intervalMs > deadline) {
      throw new AigifmakerError(`Task ${id} is still running (unpaid accounts wait in a short queue). Call check_gif with this id in a minute or two.`, 'timeout');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
