import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import { dayStatus, type DayStatus } from "@/app/lib/day-status";
import type { DayLog, UserProfile } from "@/app/lib/types";

export const dynamic = "force-dynamic";

// GET /api/log/month?from=YYYY-MM-DD&
