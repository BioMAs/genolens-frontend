/**
 * Reads the e-mails the local backend sends, through Mailpit's HTTP API.
 * `MAILPIT_URL` is the web/API base (default http://localhost:8025).
 */

export type LinkPath = '/auth/verify-email' | '/auth/reset' | '/auth/invite';

interface MailpitSummary {
  ID: string;
  Created: string;
}

interface MailpitMessage {
  Text?: string;
  HTML?: string;
}

const mailpitUrl = () => (process.env.MAILPIT_URL ?? 'http://localhost:8025').replace(/\/+$/, '');

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mailpitGet<T>(path: string): Promise<T> {
  const response = await fetch(`${mailpitUrl()}${path}`);
  if (!response.ok) throw new Error(`Mailpit answered ${response.status} for ${path}`);
  return (await response.json()) as T;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The first link to `path` (with its token) in a message body, or null. */
function findLink(message: MailpitMessage, path: string): string | null {
  const pattern = new RegExp(`https?://[^\\s"'<>]+${escapeRegExp(path)}\\?token=[^\\s"'<>&]+`);
  const fromText = message.Text?.match(pattern)?.[0];
  if (fromText) return fromText;
  // The HTML part escapes `&` only; a token is URL-encoded, so the match is the same.
  return message.HTML?.match(pattern)?.[0] ?? null;
}

/**
 * The link to `path` in the most recent e-mail sent to `to`. The backend sends
 * after it has answered, so the message may be a moment late: poll for it.
 */
export async function latestLink(
  to: string,
  path: LinkPath,
  { timeoutMs = 20_000 }: { timeoutMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let seen = 0;

  for (;;) {
    const found = await mailpitGet<{ messages?: MailpitSummary[] }>(
      `/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    const newestFirst = [...(found.messages ?? [])].sort(
      (a, b) => Date.parse(b.Created) - Date.parse(a.Created),
    );
    seen = newestFirst.length;

    for (const summary of newestFirst) {
      const message = await mailpitGet<MailpitMessage>(`/api/v1/message/${summary.ID}`);
      const link = findLink(message, path);
      if (link) return link;
    }

    if (Date.now() >= deadline) {
      throw new Error(`No e-mail to ${to} carried a ${path} link after ${timeoutMs} ms (${seen} message(s) found).`);
    }
    await sleep(500);
  }
}
