import { describe, expect, it } from "vitest";
import { parseMentorReply } from "@/lib/mentor/reply-parser";

describe("parseMentorReply", () => {
  it("parses a hint reply with both hintLevel and problem", () => {
    const result = parseMentorReply("[[MENTOR_META hintLevel=2 problem=two-sum]]\nThink about what you'd need to remember as you scan the array.");
    expect(result).toEqual({
      message: "Think about what you'd need to remember as you scan the array.",
      hintLevel: 2,
      problemSlug: "two-sum",
    });
  });

  it("parses a problem-specific, non-hint reply (just problem, no hintLevel)", () => {
    const result = parseMentorReply("[[MENTOR_META problem=binary-search]]\nThis problem asks you to find a target in a sorted array.");
    expect(result).toEqual({
      message: "This problem asks you to find a target in a sorted array.",
      hintLevel: null,
      problemSlug: "binary-search",
    });
  });

  it("returns the whole text untouched, with null fields, when there's no meta line", () => {
    const result = parseMentorReply("You're at 62/100 readiness — Building Fundamentals.");
    expect(result).toEqual({
      message: "You're at 62/100 readiness — Building Fundamentals.",
      hintLevel: null,
      problemSlug: null,
    });
  });

  it("clamps an out-of-range hint level rather than passing it through raw", () => {
    const result = parseMentorReply("[[MENTOR_META hintLevel=9 problem=two-sum]]\nHere's the full solution.");
    expect(result.hintLevel).toBe(6);
  });

  it("degrades gracefully when the meta line is malformed — treats it as plain text", () => {
    const result = parseMentorReply("[[MENTOR_META this is not the right format]]\nSome reply.");
    expect(result.message).toContain("[[MENTOR_META this is not the right format]]");
    expect(result.hintLevel).toBeNull();
    expect(result.problemSlug).toBeNull();
  });

  it("trims surrounding whitespace from the message", () => {
    const result = parseMentorReply("[[MENTOR_META problem=two-sum]]\n   Some reply with leading space.   ");
    expect(result.message).toBe("Some reply with leading space.");
  });
});
