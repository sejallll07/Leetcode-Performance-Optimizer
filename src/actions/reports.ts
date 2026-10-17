"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getReport } from "@/services/reports/reports-service";
import type { ReportPeriodType, ReportResult } from "@/lib/reports/types";

export type GetReportActionResult = { ok: true; report: ReportResult } | { ok: false; error: string };

export async function getReportAction(periodType: ReportPeriodType, offset: number): Promise<GetReportActionResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "You need to be signed in." };
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return { ok: false, error: "Invalid period." };
  }
  return getReport(session.user.id, periodType, offset);
}
