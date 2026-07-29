import { describe, expect, it } from "vitest";
import { formatDuration, formatFileSize } from "./format.ts";

describe("formatDuration", () => {
  it("formats milliseconds", () => expect(formatDuration(125_000)).toBe("2:05"));
  it("handles invalid values", () => expect(formatDuration(Number.NaN)).toBe("0:00"));
});

describe("formatFileSize", () => {
  it("formats megabytes", () => expect(formatFileSize(1_572_864)).toBe("1.5 МБ"));
});
