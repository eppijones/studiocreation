/**
 * @mention parsing. Comment bodies carry canonical `@handle` tokens (the
 * annotation composer's autocomplete inserts these), so a handle is a simple
 * slug — no spaces. Pure + testable: resolution to user ids happens in notify.ts.
 */

// `@` + handle slug (letters, digits, dot, dash). Must not be preceded by a word
// char so emails like "a@b.com" don't match as a mention of "b.com".
const MENTION_RE = /(?:^|[^\w@])@([a-z0-9][a-z0-9._-]*)/gi;

/** Extract distinct lowercased handles mentioned in a body of text. */
export function parseMentions(body: string | null | undefined): string[] {
  if (!body) return [];
  const out = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) {
    const handle = m[1].toLowerCase().replace(/[._-]+$/, ""); // trim trailing punctuation
    if (handle) out.add(handle);
  }
  return [...out];
}
