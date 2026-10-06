import { DocumentReference, Timestamp, type DocumentData } from "firebase-admin/firestore";

// Filet de securite contre l'ecrasement silencieux : avant tout set/update/delete
// d'un document existant sous users/{id}/..., la version precedente est copiee dans
// users/{id}/_history si l'ecriture en change reellement le contenu. Installe une
// seule fois sur le prototype de DocumentReference, donc couvre aussi les futures routes.

const SKIP_KEYS = new Set(["updatedAt", "loggedAt", "syncedAt"]);
const IMAGE_FIELDS = ["faceImageUrl", "image"];
const SKIP_PATH = /^users\/[^/]+\/(_history|oauthTokens)\/|^(debug|system)\//;
const MAX_BYTES = 900_000;

type Kind = "set" | "update" | "delete";
type Writer = (this: DocumentReference, ...args: unknown[]) => Promise<unknown>;

function plain(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toMillis();
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.isEqual === "function" || typeof o._methodName === "string") return "[sentinel]";
    return Object.fromEntries(Object.entries(o).filter(([k]) => !SKIP_KEYS.has(k)).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

const same = (a: unknown, b: unknown) => JSON.stringify(plain(a)) === JSON.stringify(plain(b));

function pick(obj: DocumentData, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function changes(existing: DocumentData, kind: Kind, incoming: DocumentData | undefined, merge: boolean): boolean {
  if (kind === "delete" || !incoming) return true;
  const keys = Object.keys(incoming).filter((k) => !SKIP_KEYS.has(k));
  if (kind === "set" && !merge) {
    const lost = Object.keys(existing).filter((k) => !SKIP_KEYS.has(k) && !(k in incoming));
    if (lost.length) return true;
  }
  return keys.some((k) => {
    const cur = kind === "update" ? pick(existing, k) : existing[k];
    const next = incoming[k];
    if (next && typeof next === "object" && typeof (next as { isEqual?: unknown }).isEqual === "function") return false;
    return !same(cur, next);
  });
}

async function archive(ref: DocumentReference, kind: Kind, incoming: DocumentData | undefined, merge: boolean, original: { set: Writer }) {
  try {
    if (SKIP_PATH.test(ref.path + "/")) return;
    const m = ref.path.match(/^users\/([^/]+)\//);
    if (!m) return;
    const snap = await ref.get();
    if (!snap.exists) return;
    let data = snap.data() as DocumentData;
    if (!changes(data, kind, incoming, merge)) return;
    // Photo inchangee (ex. ajout des mesures d'un scan) : inutile de la recopier dans l'historique a chaque
    // modification. Sur une suppression, la photo est archivee en entier.
    if (kind !== "delete") {
      for (const f of IMAGE_FIELDS) {
        if (typeof data[f] === "string" && (data[f] as string).startsWith("data:") && !(incoming && f in incoming)) {
          data = { ...data, [f]: "[photo inchangée : conservée dans le document]" };
        }
      }
    }
    if (JSON.stringify(plain(data)).length > MAX_BYTES) {
      console.error(`[write-guard] ${ref.path}: trop volumineux pour l'historique`);
      return;
    }
    const target = ref.firestore.collection(`users/${m[1]}/_history`).doc();
    await original.set.call(target, { path: ref.path, kind, archivedAt: Timestamp.now(), data });
  } catch (e) {
    console.error("[write-guard] archivage impossible", ref.path, e);
  }
}

export function installWriteGuard() {
  const proto = DocumentReference.prototype as unknown as Record<string, Writer> & { __guarded?: boolean };
  if (proto.__guarded) return;
  proto.__guarded = true;
  const original = { set: proto.set, update: proto.update, delete: proto.delete };

  proto.set = async function (this: DocumentReference, data: unknown, options?: unknown) {
    const merge = !!(options && typeof options === "object" && ("merge" in options || "mergeFields" in options));
    await archive(this, "set", data as DocumentData, merge, original);
    return original.set.call(this, data, options);
  } as Writer;
  proto.update = async function (this: DocumentReference, ...args: unknown[]) {
    const first = args[0];
    const incoming = typeof first === "string"
      ? Object.fromEntries(Array.from({ length: Math.floor(args.length / 2) }, (_, i) => [args[i * 2] as string, args[i * 2 + 1]]))
      : (first as DocumentData);
    await archive(this, "update", incoming, true, original);
    return original.update.apply(this, args);
  } as Writer;
  proto.delete = async function (this: DocumentReference, ...args: unknown[]) {
    await archive(this, "delete", undefined, false, original);
    return original.delete.apply(this, args);
  } as Writer;
}
