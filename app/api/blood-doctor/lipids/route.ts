import { NextResponse } from "next/server";
import { getBloodDoctorLipidHistory } from "@/app/lib/blood-doctor-source";

export const dynamic = "force-dynamic";

export async function GET() {
  const readings = await getBloodDoctorLipidHistory();
  return NextResponse.json({ readings });
}
