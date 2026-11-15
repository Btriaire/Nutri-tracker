import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import { dayStatus, type DayStatus } from "@/app/lib/day-status";
import type { DayLog, UserProfile } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to || new Date(to).getTime() - new Date(from).getTime() > 93 * 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const [foodLogSnapshot, userDoc] = await Promise.all([
        db.collection(`users/${session.userId}/foodLog`)
            .where(FieldPath.documentId(), ">=", from)
            .where(FieldPath.documentId(), "<=", to)
            .select("entries", "totals")
            .get(),
        db.doc(`users/${session.userId}`).get()
    ]);

    const userProfile = userDoc.data() as UserProfile;
    const goalKcal = userProfile?.goals?.dailyCalories ?? defaultGoals().dailyCalories;

    const days: Record<string, { status: DayStatus; kcal: number }> = {};

    foodLogSnapshot.forEach(doc => {
        const dayLog = doc.data() as DayLog;
        const date = doc.id;
        const entries = dayLog.entries || [];
        const totals = dayLog.totals;

        const kcal = Math.round(totals?.calories ?? entries.reduce((sum, entry) => sum + (entry.nutrition?.calories || 0), 0));
        const status = dayStatus(entries, goalKcal);

        days[date] = { status, kcal };
    });

    return NextResponse.json({ goal: goalKcal, days });
}
