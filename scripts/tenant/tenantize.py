#!/usr/bin/env python3
"""Passe une route Next.js au multi-utilisateur : users/owner -> users/${USER}, USER = session.userId.

Usage : python3 scripts/tenant/tenantize.py <fichier.ts> [...]
- Supprime les constantes `const USER = "owner";` (et USER_ID / userId).
- Ajoute `const USER = session.userId;` dans chaque GET/POST/PUT/PATCH/DELETE
  (en reutilisant le garde-fou getSession existant s'il est deja la).
- Remplace les chemins "users/owner..." par des template strings.
- Ne touche PAS aux fonctions annexes : tsc signale les USER manquants, a corriger a la main.
"""
import re
import sys

GUARD = [
    "  const session = await getSession();",
    '  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });',
    "  const USER = session.userId;",
]
HANDLER = re.compile(r"^export async function (GET|POST|PUT|PATCH|DELETE)\(.*\) \{$")


def transform(path: str) -> bool:
    src = open(path, encoding="utf-8").read()
    s = re.sub(r'^const (USER|USER_ID|userId) = "owner";\n', "", src, flags=re.M)
    lines = s.split("\n")
    out, i = [], 0
    while i < len(lines):
        out.append(lines[i])
        if HANDLER.match(lines[i]):
            head = lines[i + 1:i + 4]
            if head and head[0].strip() == GUARD[0].strip() and len(head) > 1 and head[1].strip().startswith("if (!session)"):
                out += [head[0], head[1], GUARD[2]]
                i += 3
                continue
            out += GUARD
        i += 1
    s = "\n".join(out)
    s = re.sub(r'"users/owner([^"]*)"', lambda m: "`users/${USER}" + m.group(1) + "`", s)
    s = s.replace("users/owner", "users/${USER}")
    if "getSession" in s and "@/app/lib/session" not in s:
        s = 'import { getSession } from "@/app/lib/session";\n' + s
    if s == src:
        return False
    open(path, "w", encoding="utf-8").write(s)
    return True


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(("modifie " if transform(p) else "inchange ") + p)
