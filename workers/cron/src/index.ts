/**
 * Cron eksternal RunOS — memicu workflow garmin-sync.yml TEPAT jam 09:00 & 21:00 WIB.
 * GHA schedule sendiri best-effort (slot bisa tertunda berjam-jam / dibuang saat
 * antrean padat); workflow_dispatch (event) tidak melewati scheduler itu.
 * Secret GITHUB_SYNC_PAT = PAT fine-grained sama dgn backend (Actions: read/write).
 */
export interface Env {
  GITHUB_SYNC_PAT: string;
  GITHUB_REPO?: string;
}

// ponytail: tipe Workers minimum inline — upgrade: @cloudflare/workers-types saat worker bertumbu
interface ScheduledController { cron: string; scheduledTime: number }
interface ExecutionContext { waitUntil(p: Promise<unknown>): void }

async function dispatch(env: Env): Promise<void> {
  const repo = env.GITHUB_REPO || 'rossihana/RunOS';
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/garmin-sync.yml/dispatches`, {
    method: 'POST',
    headers: {
      // GitHub API mewajibkan User-Agent — fetch di Workers tidak menambahkannya otomatis
      'User-Agent': 'RunOS-Cron/1.0',
      Authorization: `Bearer ${env.GITHUB_SYNC_PAT}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs: { mode: 'schedule' } }),
  });
  if (!r.ok) throw new Error(`dispatch ${r.status}: ${(await r.text()).slice(0, 160)}`);
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(dispatch(env));
  },
  // /run = verifikasi manual: curl -X POST https://runos-cron.<subdomain>.workers.dev/run -H "Authorization: Bearer <PAT>"
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/run' && req.headers.get('Authorization') === `Bearer ${env.GITHUB_SYNC_PAT}`) {
      await dispatch(env);
      return new Response('dispatched');
    }
    return new Response('runos-cron ok');
  },
};
