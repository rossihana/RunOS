/**
 * Jembatan backend → GitHub Actions (deploy serverless: Vercel TIDAK bisa spawn Python,
 * jadi sync/verify Garmin dijalankan oleh workflow `garmin-sync.yml` lewat workflow_dispatch).
 *
 * Local dev TANPA GITHUB_SYNC_PAT → ghEnabled() false → garminPerUser memakai jalur lama
 * (spawn venv Windows) seperti sebelum deploy.
 *
 * PAT: fine-grained token utk repo ini — Contents: read, Actions: read/write.
 * Status pakai run API (stateless) → aman untuk serverless tanpa memori antar-invoke.
 */

const WF = 'garmin-sync.yml';

export const ghEnabled = (): boolean => Boolean(process.env.GITHUB_SYNC_PAT);
const repo = (): string => process.env.GITHUB_REPO || 'rossihana/RunOS';

async function gh<T = any>(path: string, init?: RequestInit): Promise<T | undefined> {
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${process.env.GITHUB_SYNC_PAT}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const txt = await r.text().catch(() => '');
  if (!r.ok) throw new Error(`GitHub ${path} → ${r.status}: ${txt.slice(0, 160)}`);
  try {
    return (txt ? JSON.parse(txt) : undefined) as T;
  } catch {
    return undefined;
  }
}

/** Dispatch workflow (async — hasilnya dibaca via latestRunStatus / callback DB). */
export async function dispatchWorkflow(inputs: Record<string, string>): Promise<void> {
  await gh(`/repos/${repo()}/actions/workflows/${WF}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: 'main', inputs }),
  });
}

export interface GhRunStatus {
  status: 'running' | 'done' | 'failed';
  detail?: string;
}

/**
 * Status run workflow_dispatch terbaru (jendela 2 jam). Endpoint /garmin/status serverless
 * memakai ini → polling frontend tetap menerima done/failed walau memori instance hilang.
 * ponytail: run verify ikut kelihatan di sini (jarang & lewat sendiri); filter per-mode
 * butuh kolom/penamaan run khusus — upgrade kalau membingungkan.
 */
export async function latestRunStatus(): Promise<GhRunStatus | null> {
  try {
    const d = await gh<any>(
      `/repos/${repo()}/actions/workflows/${WF}/runs?event=workflow_dispatch&branch=main&per_page=5`
    );
    const run = (d?.workflow_runs || []).find(
      (r: any) => Date.now() - Date.parse(r.created_at) < 2 * 3600 * 1000
    );
    if (!run) return null;
    if (run.status !== 'completed') return { status: 'running' };
    return run.conclusion === 'success'
      ? { status: 'done' }
      : { status: 'failed', detail: `Lihat log: ${run.html_url}` };
  } catch {
    return null; // error GitHub saat poll → frontend lanjut polling (sama dgn status null)
  }
}
