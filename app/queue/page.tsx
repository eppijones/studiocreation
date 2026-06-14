"use client";

import Link from "next/link";
import { useStudio } from "../components/AppShell";
import { Card, Btn, Pill, Cost, useToast } from "../components/ui";
import { Media } from "../components/Media";
import { Icon } from "../components/Icon";
import { JobProgress } from "../components/JobProgress";
import { glowVars, modelShort, relTime, cancelJob, isInFlight, type ClientJob as Job } from "../components/studio";

function headline(running: number, queued: number): string {
  if (running === 0 && queued === 0) return "Queue clear";
  const parts: string[] = [];
  if (running) parts.push(`${running} generating`);
  if (queued) parts.push(`${queued} waiting`);
  return parts.join(" · ");
}

/* ---------- one job row ---------- */
function JobRow({ job, onCancel }: { job: Job; onCancel?: (job: Job) => void }) {
  const isRunning = job.status === "running";
  const isError = job.status === "error";
  const isDone = job.status === "done";
  const inFlight = isInFlight(job.status);
  const thumb = job.assets[0];

  return (
    <div className="linerow" style={glowVars(job.operator)}>
      <Media
        src={thumb?.blob_url}
        kind={thumb?.content_type}
        hueKey={job.operator}
        aspect="3 / 2"
        style={{ width: 110, flex: "none" }}
      />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row gap2" style={{ alignItems: "baseline" }}>
          <span className="t-sm" style={{ color: "var(--tx-1)", fontWeight: 600 }}>
            {job.operator}
          </span>
          <span className="t-xs mono muted" style={{ whiteSpace: "nowrap" }}>
            {modelShort(job.model)} · {job.project}/{job.label}
          </span>
        </div>
        <div
          className="t-sm"
          style={{
            color: "var(--tx-2)",
            marginTop: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {job.prompt}
        </div>
        {(isRunning || job.status === "queued") && (
          <div style={{ marginTop: 9 }}>
            <JobProgress job={job} />
          </div>
        )}
        {isError && job.error && (
          <div className="t-xs mono" style={{ color: "var(--bad-tx)", marginTop: 6 }}>
            ⚠️ {job.error}
          </div>
        )}
        {isDone && (
          <Link
            href="/gallery"
            className="t-xs"
            style={{ color: "var(--accent-hi)", marginTop: 6, display: "inline-block", fontWeight: 600 }}
          >
            Review →
          </Link>
        )}
      </div>
      <div className="col gap1" style={{ alignItems: "flex-end", flex: "none" }}>
        <Cost usd={Number(job.est_usd)} variant={isError ? undefined : "accent"} />
        <Pill state={job.status} />
        <span className="t-xs muted mono">{relTime(job.created_at)}</span>
        {inFlight && onCancel && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 2 }} onClick={() => onCancel(job)} title="Stop this generation">
            <Icon name="x" size={13} /> Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- section ---------- */
function Section({
  icon,
  color,
  title,
  jobs,
  onCancel,
}: {
  icon: string;
  color: string;
  title: string;
  jobs: Job[];
  onCancel?: (job: Job) => void;
}) {
  if (jobs.length === 0) return null;
  return (
    <Card>
      <div className="card-hd">
        <span className="t-h3 row gap2" style={{ alignItems: "center" }}>
          <span style={{ color, display: "inline-flex" }}>
            <Icon name={icon} size={18} />
          </span>
          {title}
          <span className="t-sm mono muted">{jobs.length}</span>
        </span>
      </div>
      <div className="card-pad col gap2">
        {jobs.map((j) => (
          <JobRow key={j.id} job={j} onCancel={onCancel} />
        ))}
      </div>
    </Card>
  );
}

export default function QueuePage() {
  // Jobs + live polling are centralized in AppShell (single reconcile loop).
  const { jobs, jobsLoaded: loaded, refresh } = useStudio();
  const toast = useToast();

  const handleCancel = async (job: Job) => {
    const status = await cancelJob(job.id);
    if (status === "canceled") {
      toast({ kind: "info", title: "Canceled", sub: `${job.project}/${job.label} — stopped before it finished` });
    } else if (status === "done") {
      toast({ kind: "ok", title: "Already landed", sub: "It finished before the cancel reached fal" });
    } else {
      toast({ kind: "bad", title: "Couldn’t cancel", sub: "It may have already finished — refreshing" });
    }
    refresh();
  };

  const running = jobs.filter((j) => j.status === "running");
  const queued = jobs.filter((j) => j.status === "queued");
  const delivered = jobs.filter((j) => j.status === "done").slice(0, 8);
  const live = running.length + queued.length;

  const nothingLive = live === 0;

  return (
    <div className="screen-pad narrow">
      <div className="screen-hd">
        <div className="titles">
          <p className="t-label t-eyebrow">Queue</p>
          <h1 className="t-display">{headline(running.length, queued.length)}</h1>
          <p className="t-body">
            {nothingLive
              ? "The line is quiet — last renders below."
              : `${running.length} on the models · ${queued.length} waiting their turn · banks on completion`}
          </p>
        </div>
        <div className="actions">
          <Link href="/create">
            <Btn variant="primary" size="lg" icon="create">
              New generation
            </Btn>
          </Link>
        </div>
      </div>

      {loaded && nothingLive && delivered.length === 0 ? (
        <div className="empty" style={{ padding: "64px 0" }}>
          <Icon name="checkcircle" size={40} />
          <span>All clear — nothing on the line.</span>
          <Link href="/create" style={{ marginTop: 6 }}>
            <Btn variant="primary" icon="create">
              Start a generation
            </Btn>
          </Link>
        </div>
      ) : (
        <div className="col gap4">
          <Section icon="bolt" color="var(--run-tx)" title="Generating" jobs={running} onCancel={handleCancel} />
          <Section icon="hourglass" color="var(--accent-hi)" title="Waiting" jobs={queued} onCancel={handleCancel} />
          <Section icon="checkcircle" color="var(--ok-tx)" title="Recently delivered" jobs={delivered} />
        </div>
      )}
    </div>
  );
}
