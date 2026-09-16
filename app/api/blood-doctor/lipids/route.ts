import { NextResponse } from "next/server";
import { getBloodDoctorLipidHistory } from "@/app/lib/blood-doctor-source";
import { getSession } from "@/app/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  // Données médicales (bilan lipidique) : double garde, middleware + route.
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const readings = await getBloodDoctorLipidHistory();
  return NextResponse.json({ readings });
}
