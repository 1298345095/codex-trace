import { describe, expect, it } from "vitest";
import { firstLine, formatExactTime, formatJson, shortModel } from "./format";

describe("formatExactTime", () => {
  it("returns empty string for empty input", () => {
    expect(formatExactTime("")).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatExactTime("not-a-date")).toBe("");
  });

  it("formats a valid ISO string as yyyy-mm-dd hh:mm:ss (space separator)", () => {
    const result = formatExactTime("2026-04-26T10:02:34.000Z");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("does not use T separator", () => {
    const result = formatExactTime("2026-04-26T10:02:34.000Z");
    expect(result).not.toContain("T");
  });
});

describe("shortModel", () => {
  it("strips the openai/ prefix", () => {
    expect(shortModel("openai/gpt-4")).toBe("gpt-4");
  });

  it("strips the anthropic/ prefix", () => {
    expect(shortModel("anthropic/claude-3")).toBe("claude-3");
  });

  it("leaves strings without a known prefix unchanged", () => {
    expect(shortModel("gpt-4")).toBe("gpt-4");
    expect(shortModel("o4-mini")).toBe("o4-mini");
  });
});

describe("firstLine", () => {
  it("returns the full string when there is no newline", () => {
    expect(firstLine("hello world")).toBe("hello world");
  });

  it("returns the first line of a multi-line string", () => {
    expect(firstLine("first\nsecond\nthird")).toBe("first");
  });

  it("returns empty string for empty input", () => {
    expect(firstLine("")).toBe("");
  });
});

describe("formatJson", () => {
  it("pretty-prints valid JSON with 2-space indent", () => {
    expect(formatJson('{"a":1,"b":2}')).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it("returns the original string for invalid JSON", () => {
    expect(formatJson("not json")).toBe("not json");
    expect(formatJson("{bad}")).toBe("{bad}");
  });
});
