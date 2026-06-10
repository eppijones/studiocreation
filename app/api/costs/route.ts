import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  const [byDay, byProject, byModel, byOperator, totals] = await Promise.all([
    sql`
      SELECT to_char(created_at AT TIME ZONE 'utc', 'YYYY-MM-DD') AS day,
             SUM(COALESCE(actual_usd, est_usd)) AS usd, COUNT(*) AS jobs
      FROM jobs WHERE status != 'error' AND created_at > now() - interval '30 days'
      GROUP BY 1 ORDER BY 1 DESC
    `,
    sql`
      SELECT project, SUM(COALESCE(actual_usd, est_usd)) AS usd, COUNT(*) AS jobs
      FROM jobs WHERE status != 'error' GROUP BY 1 ORDER BY 2 DESC
    `,
    sql`
      SELECT model, SUM(COALESCE(actual_usd, est_usd)) AS usd, COUNT(*) AS jobs
      FROM jobs WHERE status != 'error' GROUP BY 1 ORDER BY 2 DESC
    `,
    sql`
      SELECT operator, SUM(COALESCE(actual_usd, est_usd)) AS usd, COUNT(*) AS jobs
      FROM jobs WHERE status != 'error' GROUP BY 1 ORDER BY 2 DESC
    `,
    sql`
      SELECT SUM(COALESCE(actual_usd, est_usd)) AS total_usd,
             SUM(actual_usd) AS reconciled_usd,
             COUNT(*) FILTER (WHERE actual_usd IS NOT NULL) AS reconciled_jobs,
             COUNT(*) AS jobs,
             SUM(COALESCE(actual_usd, est_usd))
               FILTER (WHERE created_at >= date_trunc('month', now())) AS month_usd
      FROM jobs WHERE status != 'error'
    `,
  ]);

  return NextResponse.json({
    byDay,
    byProject,
    byModel,
    byOperator,
    totals: totals[0],
  });
}
