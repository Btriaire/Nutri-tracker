import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { localLifeAnalysis } from "@/app/lib/life-keywords";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { GROQ_URL, GROQ_TEXT_MODEL } from "@/app/lib/groq";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

export type LifeNoteKind = "vie" | "comportement";

export interface LifeNote {
  id: string;
  date: string;
  text: string;
  keywords: string[];
  kind: LifeNoteKind;
  persistent: boolean;
  summary: string;
  carriedFrom?: string;
  createdAt: string;
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

async function getGroqAnalysis(text: string): Promise<Partial<LifeNote>> {
  try {
    // Delai max : sans lui, une reponse Groq qui ne vient jamais bloque l'enregistrement indefiniment
    const response = await fetch(GROQ_URL, {
      signal: AbortSignal.timeout(8000),
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        temperature: 0.2,
        reasoning_effort: "low",
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Analyse le texte suivant et réponds strictement en JSON avec les champs : keywords (3 à 6 mots ou expressions en français, minuscules, sans ponctuation), kind ('vie' ou 'comportement'), persistent (true si changement durable, false sinon), summary (phrase de 15 mots max)."
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });

    if (!response.ok) throw new Error("Groq API error");

    // La reponse Groq est { choices: [{ message: { content } }] } : le JSON utile est dans content
    const body = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content ?? "{}";
    const data = JSON.parse(content) as { keywords?: unknown; kind?: unknown; persistent?: unknown; summary?: unknown };
    if (!Array.isArray(data.keywords) || typeof data.persistent !== "boolean" || typeof data.summary !== "string") {
      throw new Error("Invalid Groq response format");
    }

    return {
      keywords: data.keywords.filter((k): k is string => typeof k === "string").slice(0, 6),
      kind: data.kind === "vie" ? "vie" : "comportement",
      persistent: data.persistent,
      summary: data.summary
    };
  } catch {
    // IA indisponible ou trop lente : analyse locale, la note s'enregistre quand meme avec des mots-cles
    return localLifeAnalysis(text);
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!date && (!from || !to)) {
    return NextResponse.json({ error: "Missing date or date range" }, { status: 400 });
  }

  if (date && !dateRegex.test(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  if ((from && !dateRegex.test(from)) || (to && !dateRegex.test(to))) {
    return NextResponse.json({ error: "Invalid date format in range" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const notesRef = db.collection(`users/${session.userId}/lifeNotes`);

  try {
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = notesRef;

    if (date) {
      query = query.where("date", "==", date);
    } else if (from && to) {
      query = query.where("date", ">=", from).where("date", "<=", to);
    }

    // Pas d'orderBy composite (il exigerait un index Firestore) : tri en memoire
    const snapshot = await query.get();
    const notes: LifeNote[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as LifeNote)).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    // "carried" : la reprise automatique de la veille a deja eu lieu ce jour-la
    const carried = date ? (await db.doc(`users/${session.userId}/lifeDays/${date}`).get()).exists : undefined;
    return NextResponse.json({ notes, carried });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, date } = await request.json();

  if (!text || typeof text !== "string" || text.length > 1000) {
    return NextResponse.json({ error: "Invalid text" }, { status: 400 });
  }

  if (!date || !dateRegex.test(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const groqAnalysis = await getGroqAnalysis(text);
  const createdAt = new Date().toISOString();
  const id = nanoid(12);

  const note: LifeNote = {
    id,
    date,
    text,
    keywords: groqAnalysis.keywords && groqAnalysis.keywords.length > 0 ? groqAnalysis.keywords : localLifeAnalysis(text).keywords,
    kind: groqAnalysis.kind || "comportement",
    persistent: groqAnalysis.persistent ?? false,
    summary: groqAnalysis.summary || (text.length > 80 ? text.substring(0, 77) + "..." : text),
    createdAt
  };

  try {
    const db = getAdminFirestore();
    await db.collection(`users/${session.userId}/lifeNotes`).doc(id).set(note);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing note ID" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    await db.collection(`users/${session.userId}/lifeNotes`).doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !dateRegex.test(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const base = `users/${session.userId}`;
    const notesRef = db.collection(`${base}/lifeNotes`);
    const dayRef = db.doc(`${base}/lifeDays/${date}`);

    // Deja repris ce jour-la (meme si l'utilisateur a tout retire) : on ne recopie plus
    if (!(await dayRef.get()).exists) {
      // Jour source : le plus recent jour anterieur ayant un marqueur de reprise ou des notes
      const [daysSnap, notesSnap] = await Promise.all([
        db.collection(`${base}/lifeDays`).get(),
        notesRef.where("date", "<", date).get(),
      ]);
      const knownDays = new Set<string>([
        ...daysSnap.docs.map(d => d.id).filter(d => d < date),
        ...notesSnap.docs.map(d => (d.data() as LifeNote).date),
      ]);
      const source = [...knownDays].sort().pop();

      if (source) {
        const sourceNotes = notesSnap.docs
          .map(d => ({ ...(d.data() as LifeNote), id: d.id }))
          .filter(n => n.date === source && n.persistent);
        const batch = db.batch();
        for (const n of sourceNotes) {
          const id = nanoid(12);
          batch.set(notesRef.doc(id), {
            id, date, text: n.text, keywords: n.keywords ?? [], kind: n.kind, persistent: true,
            summary: n.summary, carriedFrom: n.id, createdAt: new Date().toISOString(),
          });
        }
        batch.set(dayRef, { carriedFrom: source, createdAt: new Date().toISOString() });
        await batch.commit();
      } else {
        await dayRef.set({ carriedFrom: null, createdAt: new Date().toISOString() });
      }
    }

    const snapshot = await notesRef.where("date", "==", date).get();
    const notes: LifeNote[] = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as LifeNote))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return NextResponse.json({ notes });
  } catch {
    return NextResponse.json({ error: "Failed to carry notes" }, { status: 500 });
  }
}
