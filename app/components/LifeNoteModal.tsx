"use client";
import { useEffect, useRef, useState } from "react";
import { IconMicrophone, IconPlayerStop, IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import Sheet from "./Sheet";
import type { LifeNote } from "@/app/api/life-notes/route";
import { localLifeAnalysis, queueLifeNote } from "@/app/lib/life-keywords";

type SpeechResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechEventLike = { resultIndex: number; results: ArrayLike<SpeechResultLike> };
type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export default function LifeNoteModal({
  open,
  date,
  onClose,
  onSaved,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  onSaved: (note: LifeNote) => void;
}) {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const examples = [
    "J'ai changé de travail",
    "Je dors mieux depuis un mois",
    "Je me déplace à vélo",
    "Période de stress au travail",
  ];

  useEffect(() => {
    if (!open) {
      setText("");
      setError("");
      setKeywords([]);
      stopRecognition();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition() as RecognitionLike;
      recognition.lang = "fr-FR";
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onresult = (e: SpeechEventLike) => {
        const transcript = Array.from(e.results)
          .map((result) => result[0].transcript)
          .join("");
        setText((prev) => prev + transcript);
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => {
        setIsListening(false);
        setError("Dictée indisponible sur ce navigateur : écris ton message ci-dessous.");
      };

      recognitionRef.current = recognition;
    } else {
      setError("Dictée indisponible sur ce navigateur : écris ton message ci-dessous.");
    }

    return () => {
      stopRecognition();
    };
  }, [open]);

  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current.onresult = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      stopRecognition();
    } else {
      setError("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSave = async () => {
    if (!text.trim() || isSaving) return;

    setIsSaving(true);
    setError("");

    const finish = (note: LifeNote) => {
      setKeywords(note.keywords || []);
      setTimeout(() => {
        onSaved(note);
        onClose();
      }, 1200);
    };
    try {
      const response = await fetch("/api/life-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, date }),
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) throw new Error();

      const { note } = (await response.json()) as { note: LifeNote };
      finish(note);
    } catch {
      // Serveur ou reseau indisponible : la note est gardee sur l'appareil, renvoyee des que possible
      const clean = text.trim();
      queueLifeNote({ text: clean, date });
      finish({ id: `local-${Date.now()}`, date, text: clean, ...localLifeAnalysis(clean), createdAt: new Date().toISOString() });
    }
  };

  const handleExampleClick = (example: string) => {
    setText(example);
    textareaRef.current?.focus();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Note de vie">
      <div className="flex flex-col gap-4 p-4">
        {!error ? (
          <div className="flex justify-center">
            <button
              onClick={toggleListening}
              className={`rounded-full w-16 h-16 flex items-center justify-center transition-colors ${
                isListening
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--layer-2)] text-[var(--text-primary)]"
              }`}
              disabled={isSaving}
            >
              {isListening ? (
                <div className="flex flex-col items-center gap-1">
                  <IconPlayerStop size={24} />
                  <div className="text-xs">Arrêter</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <IconMicrophone size={24} />
                  <div className="text-xs">Écouter</div>
                </div>
              )}
            </button>
            {isListening && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 text-sm text-[var(--text-muted)]">
                Je t'écoute…
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-[var(--danger)] text-center">{error}</div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full min-h-[120px] p-3 text-base bg-[var(--layer-2)] border border-[var(--border)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          placeholder="Écris ou parle…"
          disabled={isSaving}
        />

        {text.trim() === "" && (
          <div className="flex flex-col gap-2">
            <div className="text-sm text-[var(--text-muted)]">Exemples :</div>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  onClick={() => handleExampleClick(example)}
                  className="px-3 py-1 text-sm bg-[var(--layer-2)] border border-[var(--border)] rounded-full hover:bg-[var(--layer-1)] transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="px-3 py-1 text-sm bg-[var(--layer-2)] border border-[var(--border)] rounded-full"
              >
                {keyword}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm text-[var(--text-primary)] bg-[var(--layer-2)] border border-[var(--border)] rounded-lg hover:bg-[var(--layer-1)] transition-colors"
            disabled={isSaving}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className={`min-h-[44px] px-4 py-2 text-sm text-white rounded-lg transition-colors flex items-center gap-2 ${
              text.trim() && !isSaving
                ? "bg-[var(--accent)] hover:bg-[var(--accent)]/90"
                : "bg-[var(--layer-2)] text-[var(--text-muted)] cursor-not-allowed"
            }`}
            disabled={!text.trim() || isSaving}
          >
            {isSaving ? (
              <>
                <IconLoader2 className="animate-spin" size={16} />
                Enregistrement…
              </>
            ) : (
              <>
                <IconCheck size={16} />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
