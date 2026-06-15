"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "./Icon";
import { FuelGauge, ToastProvider, CountUp, useToast } from "./ui";
import { getSkin, toggleSkin, usd, isInFlight, type Skin, type ClientJob } from "./studio";
import { osNotify, chime } from "./notify";
import type { BudgetView } from "./BudgetBanner";

type NavItem = { href: string; label: string; icon: string; badge?: "run" | "score" };

// Creative-first: the two things you do live up top; the "go deeper" views sit
// below a divider. Briefs / Workflows / Deliver stay routable but out
// of the everyday rail.
const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Showcase", icon: "gallery" },
  { href: "/create", label: "Create", icon: "create" },
  { href: "/brands", label: "Brands", icon: "spark" },
  { href: "/gallery", label: "Gallery", icon: "image", badge: "score" },
];
const DEEPER_NAV: NavItem[] = [
  { href: "/overview", label: "Overview", icon: "dashboard" },
  { href: "/queue", label: "Generations", icon: "queue", badge: "run" },
  { href: "/roles", label: "Roles", icon: "wand" },
  { href: "/costs", label: "Costs", icon: "costs" },
  { href: "/settings", label: "Settings", icon: "settings" },
];
const NAV: NavItem[] = [...PRIMARY_NAV, ...DEEPER_NAV];
const DIVIDER_OFFSET = 22; // matches .nav-divider height + flex gap

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

interface StudioState {
  operator: string;
  role: string;
  budget: BudgetView | null;
  jobs: ClientJob[];
  jobsLoaded: boolean;
  activeJobs: number;
  needsScoring: number;
  refresh: () => void;
}
const StudioCtx = createContext<StudioState>({
  operator: "unknown",
  role: "",
  budget: null,
  jobs: [],
  jobsLoaded: false,
  activeJobs: 0,
  needsScoring: 0,
  refresh: () => {},
});
export const useStudio = () => useContext(StudioCtx);

/**
 * Fires the completion ping — in-app toast + OS notification + soft chime —
 * the moment a job we were watching flips done/error. Lives inside the toast +
 * studio providers so it can read live jobs and push toasts.
 */
function JobWatcher() {
  const { jobs } = useStudio();
  const toast = useToast();
  const prevStatusRef = useRef<Map<number, string>>(new Map());
  const readyRef = useRef(false);

  useEffect(() => {
    const prev = prevStatusRef.current;
    const next = new Map<number, string>();
    const justDone: ClientJob[] = [];
    const justError: ClientJob[] = [];
    for (const j of jobs) {
      next.set(j.id, j.status);
      const was = prev.get(j.id);
      if (readyRef.current && (was === "queued" || was === "running")) {
        if (j.status === "done") justDone.push(j);
        else if (j.status === "error") justError.push(j);
      }
    }
    prevStatusRef.current = next;
    // First population on mount just records state — don't ping pre-existing jobs.
    if (!readyRef.current) {
      readyRef.current = true;
      return;
    }
    for (const j of justDone) {
      const where = `${j.project}/${j.label}`;
      const n = j.assets.length;
      toast({ kind: "ok", title: "Render ready — go check it out", sub: `${where} · ${n} render${n === 1 ? "" : "s"} in the gallery` });
      osNotify("Render ready ✓", `${where} just landed in the gallery`);
      chime("done");
    }
    for (const j of justError) {
      toast({ kind: "bad", title: "Generation failed", sub: j.error ?? `${j.project}/${j.label}` });
      osNotify("Generation failed", j.error ?? `${j.project}/${j.label}`);
      chime("error");
    }
  }, [jobs, toast]);

  return null;
}

/** First-run nudge that makes the studio's flow legible. Dismissed for good
 *  via localStorage; never shown on the login wall. Additive — fails closed. */
function OnboardingBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem("sc.onboarded") !== "1");
    } catch {
      /* storage blocked — just don't show it */
    }
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      localStorage.setItem("sc.onboarded", "1");
    } catch {
      /* non-fatal */
    }
    setShow(false);
  };
  return (
    <div className="onboard-banner">
      <span className="onboard-ic"><Icon name="spark" size={15} /></span>
      <div className="grow" style={{ minWidth: 0 }}>
        <strong>New to the studio?</strong>{" "}
        <span className="muted">Pick a</span> <Link href="/roles">Role</Link>{" "}
        <span className="muted">→ describe it in</span> <Link href="/create">Create</Link>{" "}
        <span className="muted">→ watch it land in</span> <Link href="/queue">Generations</Link>{" "}
        <span className="muted">→ review in the</span> <Link href="/gallery">Gallery</Link>{" "}
        <span className="muted">→ finish &amp; deliver.</span>
      </div>
      <button className="icon-btn ghost" onClick={dismiss} aria-label="Dismiss the welcome tip">
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  const [operator, setOperator] = useState("unknown");
  const [role, setRole] = useState("");
  const [budget, setBudget] = useState<BudgetView | null>(null);
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [needsScoring, setNeedsScoring] = useState(0);
  const [skin, setSkinState] = useState<Skin>("onyx");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [b, j, a] = await Promise.all([
        fetch("/api/budget"),
        fetch("/api/jobs"),
        fetch("/api/assets?status=new"),
      ]);
      if (b.ok) setBudget(await b.json());
      if (j.ok) {
        setJobs(((await j.json()).jobs as ClientJob[]) ?? []);
        setJobsLoaded(true);
      }
      if (a.ok) {
        const assets = (await a.json()).assets as { score: number | null }[];
        setNeedsScoring(assets.filter((x) => x.score == null).length);
      }
    } catch {
      /* offline / pre-migration — leave defaults */
    }
  }, []);

  const activeJobs = useMemo(() => jobs.filter((j) => isInFlight(j.status)).length, [jobs]);

  useEffect(() => {
    if (isLogin) return;
    setOperator(readCookie("studio_operator") || "unknown");
    setRole(readCookie("studio_role"));
    setSkinState(getSkin());
    refresh();
  }, [isLogin, refresh]);

  // light poll while jobs are in flight so the rail gauge + badges stay live
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (isLogin || activeJobs === 0) return;
    pollRef.current = setInterval(refresh, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLogin, activeJobs, refresh]);

  if (isLogin) return <ToastProvider>{children}</ToastProvider>;

  const weekPct = budget ? Math.round((budget.spentWeekUsd / budget.settings.weeklyCapUsd) * 100) : 0;
  const hot = weekPct >= 75;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const activeIndex = NAV.findIndex((n) => isActive(n.href));
  const inkTop = activeIndex < 0 ? 0 : activeIndex * 42 + (activeIndex >= PRIMARY_NAV.length ? DIVIDER_OFFSET : 0);

  const renderNavItem = (n: NavItem) => {
    const on = isActive(n.href);
    const badge =
      n.badge === "run" && activeJobs > 0 ? (
        <span className="nav-badge run">{activeJobs}</span>
      ) : n.badge === "score" && needsScoring > 0 ? (
        <span className="nav-badge accent">{needsScoring}</span>
      ) : null;
    return (
      <Link key={n.href} href={n.href} className={`navitem ${on ? "on" : ""}`}>
        <span className="nicon">
          <Icon name={n.icon} size={18} />
        </span>
        <span className="nlabel">{n.label}</span>
        {badge}
      </Link>
    );
  };

  return (
    <ToastProvider>
      <StudioCtx.Provider value={{ operator, role, budget, jobs, jobsLoaded, activeJobs, needsScoring, refresh }}>
        <JobWatcher />
        <div className="shell">
          <a href="#main" className="skip-link">Skip to content</a>
          <aside className="rail">
            <Link href="/" className="rail-brand">
              <span className="glyph">
                <Icon name="bolt" size={17} />
              </span>
              <span>
                <span className="name">StudioCreation</span>
                <br />
                <span className="sub">Production Studio</span>
              </span>
            </Link>

            <nav className="rail-nav">
              <span
                className="nav-ink"
                style={{ top: inkTop, opacity: activeIndex < 0 ? 0 : 1 }}
                aria-hidden
              />
              {PRIMARY_NAV.map(renderNavItem)}
              <div className="nav-divider" aria-hidden />
              {DEEPER_NAV.map(renderNavItem)}
            </nav>

            <div className="grow" />

            {budget && (
              <div className="card card-pad gauge-card-body" style={{ padding: 13 }}>
                <div className="between" style={{ marginBottom: 8 }}>
                  <span className="t-label">This week&apos;s budget</span>
                  <span className="mono t-xs" style={{ color: hot ? "var(--warn-tx)" : "var(--tx-3)" }}>
                    {weekPct}%
                  </span>
                </div>
                <FuelGauge spent={budget.spentWeekUsd} cap={budget.settings.weeklyCapUsd} />
                <div className="between mono t-xs" style={{ marginTop: 8 }}>
                  <span><CountUp value={budget.spentWeekUsd} prefix="$" /> used</span>
                  <span style={{ color: "var(--tx-2)" }}><CountUp value={budget.remainingWeekUsd} prefix="$" /> left</span>
                </div>
                <div className="hr" style={{ margin: "10px 0" }} />
                <div className="between mono t-xs">
                  <span className="muted">Team pool</span>
                  <span>
                    {usd(budget.spentMonthUsd)} / {usd(budget.settings.monthlyPoolUsd, 0)}
                  </span>
                </div>
                {budget.jobsWeek > 0 && (
                  <div className="between mono t-xs" style={{ marginTop: 6 }}>
                    <span className="muted">≈ /week at this pace</span>
                    <span style={{ color: "var(--tx-2)" }}>
                      {usd(budget.projectedWeekUsd)}{" "}
                      <span className="muted">· {usd(budget.avgJobUsd, 3)}/job</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="rail-foot">
              <div className="rail-op">
                <span className="av sq" style={{ width: 30, height: 30, fontSize: 12 }}>
                  {operator.slice(0, 2).toUpperCase()}
                </span>
                <div className="grow">
                  <div className="op-name">{operator}</div>
                  <div className="op-role">{role || "operator"}</div>
                </div>
                <button
                  className="theme-toggle"
                  title="Toggle light / dark skin"
                  onClick={() => setSkinState(toggleSkin())}
                >
                  <Icon name={skin === "lumen" ? "moon" : "sun"} size={16} />
                </button>
              </div>
            </div>
          </aside>

          <main className="main" id="main" tabIndex={-1}>
            <div className={`activity-ribbon ${activeJobs > 0 ? "on" : ""}`} />
            <OnboardingBanner />
            <div className="screen-wrap" key={pathname}>
              {children}
            </div>
          </main>
        </div>
      </StudioCtx.Provider>
    </ToastProvider>
  );
}
