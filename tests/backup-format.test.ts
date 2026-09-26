import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { revive } from "../app/lib/backup-format";

describe("revive", () => {
  it("reconvertit les timestamps marques, y compris imbriques", () => {
    const out = revive({ a: { __ts: 1700000000, nanos: 5 }, list: [{ t: { __ts: 10, nanos: 0 } }], n: 3 }) as {
      a: Timestamp; list: { t: Timestamp }[]; n: number;
    };
    expect(out.a).toBeInstanceOf(Timestamp);
    expect(out.a.seconds).toBe(1700000000);
    expect(out.a.nanoseconds).toBe(5);
    expect(out.list[0].t.seconds).toBe(10);
    expect(out.n).toBe(3);
  });

  it("laisse intacts les objets ordinaires et les chaines ISO", () => {
    const src = { d: "2026-09-01T10:00:00.000Z", x: { __ts: 1, other: true } };
    expect(revive(src)).toEqual(src);
  });
});
