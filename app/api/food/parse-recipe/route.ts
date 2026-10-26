import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { GROQ_URL, GROQ_TEXT_MODEL } from "@/app/lib/groq";

export const dynamic = "force-dynamic";

export interface ParsedIngredient {
    name: string;
    grams: number;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text } = await request.json();
    if (typeof text !== "string" || text.trim().length === 0 || text.length > 4000) {
        return NextResponse.json({ error: "Invalid text" }, { status: 400 });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(GROQ_URL, {
            method: "POST",
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: GROQ_TEXT_MODEL,
                temperature: 0.1,
                reasoning_effort: "low",
                max_tokens: 3000,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: "Tu es nutritionniste. Extrais chaque ingrédient du texte. Convertis toutes les quantités en grammes (1 c. à soupe = 15 g, 1 c. à café = 5 g, 1 œuf = 55 g, 1 tranche de pain = 30 g, 1 verre = 200 ml = 200 g, etc.). Si aucune quantité n'est donnée, estime une quantité raisonnable. Réponds uniquement en JSON { \"ingredients\": [ { \"name\": string (français, sans quantité), \"grams\": number, \"calories\": number, \"proteinG\": number, \"carbsG\": number, \"fatG\": number, \"fiberG\": number } ] } ou calories et macros correspondent à la quantité totale en grammes de cet ingrédient (pas pour 100 g). Maximum 30 ingrédients.",
                    },
                    { role: "user", content: text },
                ],
            }),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error("Groq request failed");
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error("Invalid Groq response");
        }

        let parsedData: { ingredients?: ParsedIngredient[] };
        try {
            parsedData = JSON.parse(content);
        } catch {
            throw new Error("Invalid JSON response");
        }

        if (!Array.isArray(parsedData.ingredients) || parsedData.ingredients.length === 0) {
            throw new Error("No ingredients found");
        }

        const validatedIngredients = parsedData.ingredients
            .map((item) => {
                const grams = Math.min(
                    Math.max(0, typeof item.grams === "number" ? item.grams : 0),
                    5000
                );
                return {
                    name: typeof item.name === "string" && item.name.trim() !== "" ? item.name.trim() : "Inconnu",
                    grams: grams,
                    calories: Math.round(Math.max(0, typeof item.calories === "number" ? item.calories : 0)),
                    proteinG: Math.round(Math.max(0, typeof item.proteinG === "number" ? item.proteinG : 0) * 10) / 10,
                    carbsG: Math.round(Math.max(0, typeof item.carbsG === "number" ? item.carbsG : 0) * 10) / 10,
                    fatG: Math.round(Math.max(0, typeof item.fatG === "number" ? item.fatG : 0) * 10) / 10,
                    fiberG: Math.round(Math.max(0, typeof item.fiberG === "number" ? item.fiberG : 0) * 10) / 10,
                };
            })
            .filter((item) => item.grams > 0 && item.name.trim() !== "");

        if (validatedIngredients.length === 0) {
            throw new Error("No valid ingredients");
        }

        return NextResponse.json({ ingredients: validatedIngredients });
    } catch (error) {
        return NextResponse.json({ error: "Analyse indisponible" }, { status: 502 });
    }
}
