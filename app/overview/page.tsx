import { redirect } from "next/navigation";

// Overview is folded into the Showcase home — one landing surface instead of three
// overlapping dashboards. The old KPI/spend cards are covered by Showcase + /costs.
// This route redirects so any existing link still resolves.
export default function OverviewPage() {
  redirect("/");
}
