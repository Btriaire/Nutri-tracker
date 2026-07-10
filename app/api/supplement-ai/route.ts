import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

const JARVIS_API = process.env.JARVIS_API_URL || "http://localhost:9999";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as { productName: string };
    if (!body.productName) {
      return NextResponse.json({ error: "Missing productName" }, { status: 400 });
    }

    // Call Jarvis API to generate supplement info
    const response = await fetch(`${JARVIS_API}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `Tu es expert en nutrition et suppléments. Pour le produit "${body.productName}", fournis UNIQUEMENT en JSON (sans markdown, sans explications):
{
  "description": "courte description du produit et ses bénéfices (2-3 lignes max)",
  "ingredients": ["ingrédient 1", "ingrédient 2"],
  "dosagePerServing": "dosage recommandé par prise (ex: 1000 IU, 500mg)",
  "recommendedDosage": "posologie recommandée (ex: 1 comprimé par jour, 2 gélules le matin et soir)"
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[supplement-ai] Jarvis error:", await response.text());
      return NextResponse.json(
        { error: "AI service unavailable", fallback: { description: "", ingredients: [], dosagePerServing: "", recommendedDosage: "" } },
        { status: 503 }
      );
    }

    const result = await response.json() as { message?: { content?: string } };
    const content = result.message?.content || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        description: "Complément alimentaire",
        ingredients: [],
        dosagePerServing: "",
        recommendedDosage: "",
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("[supplement-ai]", e);
    return NextResponse.json(
      { error: "Failed to generate supplement info", fallback: { description: "", ingredients: [], dosagePerServing: "", recommendedDosage: "" } },
      { status: 500 }
    );
  }
}
