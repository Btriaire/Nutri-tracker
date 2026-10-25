import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
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
      signal: AbortSignal.timeout(12000),
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        temperature: 0.2,
        max_tokens: 400,
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
  } catch (error) {
    return {
      keywords: [],
      kind: "comportement",
      persistent: false,
      summary: text.length > 80 ? text.substring(0, 77) + "..." : text
    };
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

    const snapshot = await query.orderBy("date").orderBy("createdAt").get();
    const notes: LifeNote[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as LifeNote));

    return NextResponse.json({ notes });
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
    keywords: groqAnalysis.keywords || [],
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
    const notesRef = db.collection(`users/${session.userId}/lifeNotes`);

    // Trouver les notes persistentes de la date la plus récente antérieure
    const previousNotesSnapshot = await notesRef
      .where("date", "<", date)
      .where("persistent", "==", true)
      .orderBy("date", "desc")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (previousNotesSnapshot.empty) {
      return NextResponse.json({ notes: [] });
    }

    const previousNote = previousNotesSnapshot.docs[0].data() as LifeNote;

    // Vérifier si une note carriedFrom existe déjà pour cette date
    const existingCarriedNote = await notesRef
      .where("date", "==", date)
      .where("carriedFrom", "==", previousNote.id)
      .limit(1)
      .get();

    if (!existingCarriedNote.empty) {
      // Récupérer toutes les notes de la date demandée
      const currentNotesSnapshot = await notesRef
        .where("date", "==", date)
        .orderBy("createdAt")
        .get();

      const currentNotes: LifeNote[] = currentNotesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LifeNote));

      return NextResponse.json({ notes: currentNotes });
    }

    // Créer la nouvelle note
    const newNote: Omit<LifeNote, "id"> = {
      ...previousNote,
      date,
      carriedFrom: previousNote.id,
      createdAt: new Date().toISOString()
    };

    const newNoteRef = notesRef.doc(nanoid(12));
    await newNoteRef.set(newNote);

    // Récupérer toutes les notes de la date demandée
    const updatedNotesSnapshot = await notesRef
      .where("date", "==", date)
      .orderBy("createdAt")
      .get();

    const updatedNotes: LifeNote[] = updatedNotesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as LifeNote));

    return NextResponse.json({ notes: updatedNotes });
  } catch (error) {
    return NextResponse.json({ error: "Failed to carry notes" }, { status: 500 });
  }
}
