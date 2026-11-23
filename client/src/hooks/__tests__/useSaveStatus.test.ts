import { describe, it, expect } from "vitest";
import { formatSavedTime } from "../useSaveStatus.js";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

describe("Save Status Protocol & Formatting", () => {
  it("formats saved time as 'Saved HH:MM' with 24-hour leading zeros", () => {
    const d1 = new Date(2026, 10, 23, 9, 5, 0).getTime();
    expect(formatSavedTime(d1)).toBe("Saved 09:05");

    const d2 = new Date(2026, 10, 23, 14, 25, 0).getTime();
    expect(formatSavedTime(d2)).toBe("Saved 14:25");
  });

  it("decodes server type 4 message with status 0 (saving)", () => {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, 0); // 0 = saving
    encoding.writeVarUint(enc, Date.now());

    const dec = decoding.createDecoder(encoding.toUint8Array(enc));
    const statusNum = decoding.readVarUint(dec);
    const timestamp = decoding.readVarUint(dec);

    expect(statusNum).toBe(0);
    expect(timestamp).toBeGreaterThan(0);
  });

  it("decodes server type 4 message with status 1 (saved) and preserves timestamp", () => {
    const fixedTime = 1795430000000;
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, 1); // 1 = saved
    encoding.writeVarUint(enc, fixedTime);

    const dec = decoding.createDecoder(encoding.toUint8Array(enc));
    const statusNum = decoding.readVarUint(dec);
    const timestamp = decoding.readVarUint(dec);

    expect(statusNum).toBe(1);
    expect(timestamp).toBe(fixedTime);
    expect(formatSavedTime(timestamp)).toMatch(/^Saved \d{2}:\d{2}$/);
  });
});
