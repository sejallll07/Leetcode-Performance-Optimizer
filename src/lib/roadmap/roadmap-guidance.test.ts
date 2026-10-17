import { describe, expect, it } from "vitest";
import type { NextAction, ProblemCatalogEntry, Recommendation } from "@/lib/analytics/types";
import {
  buildTopicGuidance,
  leetcodeProblemUrl,
  pickFocus,
  summarizeRevisionByTopic,
} from "@/lib/roadmap/roadmap-guidance";
import { buildTopicIndex } from "@/lib/roadmap/roadmap-view";
import type { RoadmapTopic } from "@/lib/roadmap/types";
import type { RevisionItemState } from "@/lib/revision/types";

function makeTopic(slug: string, overrides: Partial<Omit<RoadmapTopic, "topicSlug">> = {}): RoadmapTopic {
  return {
    topicSlug: slug,
    topicName: slug,
    tier: 0,
    status: "Strong",
    masteryScore: 80,
    confidence: "High",
    prerequisites: [],
    recommendedAction: "Maintain",
    actionReason: `${slug} reason`,
    isPrerequisiteGap: false,
    ...overrides,
  };
}
const prereq = (slug: string, isWeak = false) => ({ topicSlug: slug, topicName: slug, isWeak });
const action = (kind: NextAction["kind"], topicSlug: string, title = `${kind} ${topicSlug}`): NextAction => ({
  kind,
  topicSlug,
  topicName: topicSlug,
  title,
  reason: `${kind} reason`,
});

describe("pickFocus", () => {
  const array = makeTopic("array", { status: "Weak", masteryScore: 40 });
  const twoPointers = makeTopic("two-pointers", {
    status: "Fundamental Gap",
    masteryScore: 10,
    prerequisites: [prereq("array", true)],
  });
  const tree = makeTopic("tree", { status: "Revision Needed", masteryScore: 75 });
  const math = makeTopic("math", { status: "Recommended Next", masteryScore: null, recommendedAction: "Start here" });
  const index = buildTopicIndex([array, twoPointers, tree, math]);

  it("a prerequisite-gap action points at the weak prerequisite, not the blocked topic", () => {
    const focus = pickFocus(
      [action("prerequisite-gap", "two-pointers", "Shore up array before more two-pointers")],
      math,
      index
    );
    expect(focus).toMatchObject({ kind: "prerequisite", actionLabel: "Work on a prerequisite first" });
    expect(focus?.topic.topicSlug).toBe("array");
    expect(focus?.forTopic?.topicSlug).toBe("two-pointers");
    expect(focus?.title).toBe("Shore up array before more two-pointers");
    expect(focus?.reason).toBe("prerequisite-gap reason");
  });

  it("uses the prerequisite the engine named when a topic has several weak ones", () => {
    const a = makeTopic("a", { status: "Weak" });
    const b = makeTopic("b", { status: "Weak" });
    const c = makeTopic("c", {
      status: "Fundamental Gap",
      prerequisites: [prereq("a", true), prereq("b", true)],
    });
    const idx = buildTopicIndex([a, b, c]);
    const focus = pickFocus([action("prerequisite-gap", "c", "Shore up b before more c")], null, idx);
    expect(focus?.topic.topicSlug).toBe("b");
  });

  it("falls back to the first weak prerequisite if the engine's wording doesn't match", () => {
    const focus = pickFocus([action("prerequisite-gap", "two-pointers", "Something else entirely")], null, index);
    expect(focus?.topic.topicSlug).toBe("array");
  });

  it("a forward-looking gap also resolves to the weak prerequisite", () => {
    const blocked = makeTopic("sliding-window", {
      status: "Postponed",
      masteryScore: null,
      prerequisites: [prereq("array", true)],
    });
    const focus = pickFocus([action("forward-looking-gap", "sliding-window")], null, buildTopicIndex([array, blocked]));
    expect(focus).toMatchObject({ kind: "prerequisite" });
    expect(focus?.topic.topicSlug).toBe("array");
    expect(focus?.forTopic?.topicSlug).toBe("sliding-window");
  });

  it("maps the other action kinds to their own topic and label", () => {
    expect(pickFocus([action("fundamental-gap", "two-pointers")], null, index)).toMatchObject({
      kind: "gap",
      actionLabel: "Fix a fundamental gap",
    });
    expect(pickFocus([action("revision", "tree")], null, index)).toMatchObject({ kind: "revise", actionLabel: "Revise" });
    expect(pickFocus([action("weak-topic", "array")], null, index)).toMatchObject({
      kind: "strengthen",
      actionLabel: "Strengthen",
    });
  });

  it("takes the first resolvable action, in the engine's order", () => {
    const focus = pickFocus([action("weak-topic", "array"), action("revision", "tree")], math, index);
    expect(focus?.topic.topicSlug).toBe("array");
  });

  it("skips an action whose topic isn't on the roadmap", () => {
    const focus = pickFocus([action("weak-topic", "ghost"), action("revision", "tree")], math, index);
    expect(focus?.topic.topicSlug).toBe("tree");
  });

  it("skips a prerequisite action with no weak prerequisite to point at", () => {
    const focus = pickFocus([action("prerequisite-gap", "tree"), action("revision", "tree")], null, index);
    expect(focus?.kind).toBe("revise");
  });

  it("with nothing urgent, falls back to the roadmap's start-something-new pick", () => {
    const focus = pickFocus([], math, index);
    expect(focus).toMatchObject({ kind: "start", title: "Start math", reason: "math reason", forTopic: null });
    expect(focus?.topic.topicSlug).toBe("math");
  });

  it("returns null when there is nothing to do", () => {
    expect(pickFocus([], null, index)).toBeNull();
  });
});

describe("leetcodeProblemUrl", () => {
  it("builds the standard LeetCode problem link", () => {
    expect(leetcodeProblemUrl("two-sum")).toBe("https://leetcode.com/problems/two-sum/");
  });
});

describe("summarizeRevisionByTopic", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  function item(id: string, topicSlug: string | null, dueAt: string, extra: Partial<RevisionItemState> = {}): RevisionItemState {
    return {
      id,
      problemSlug: `problem-${id}`,
      problemTitle: `Problem ${id}`,
      difficulty: "Medium",
      topicSlug,
      topicName: topicSlug,
      intervalIndex: 0,
      dueAt: new Date(dueAt),
      lastReviewedAt: null,
      lastFeedback: null,
      reviewCount: 0,
      ...extra,
    };
  }

  const items = [
    item("1", "array", "2026-09-29T00:00:00Z"), // 5 days overdue
    item("2", "array", "2026-10-04T00:00:00Z"), // due today
    item("3", "array", "2026-10-10T00:00:00Z"), // upcoming
    item("4", "tree", "2026-10-20T00:00:00Z"), // upcoming only
    item("5", null, "2026-09-01T00:00:00Z"), // no topic → ignored
  ];
  const summary = summarizeRevisionByTopic(items, now);

  it("counts due (overdue + today), overdue, upcoming and tracked per topic", () => {
    expect(summary.array).toMatchObject({ dueCount: 2, overdueCount: 1, upcomingCount: 1, trackedCount: 3 });
    expect(summary.tree).toMatchObject({ dueCount: 0, overdueCount: 0, upcomingCount: 1, trackedCount: 1 });
  });

  it("ignores items with no topic", () => {
    expect(Object.keys(summary).sort()).toEqual(["array", "tree"]);
  });

  it("lists due items most overdue first, with days overdue and a link", () => {
    expect(summary.array.dueItems.map((i) => [i.problemSlug, i.daysOverdue])).toEqual([
      ["problem-1", 5],
      ["problem-2", 0],
    ]);
    expect(summary.array.dueItems[0].url).toBe("https://leetcode.com/problems/problem-1/");
    expect(summary.tree.dueItems).toEqual([]);
  });

  it("lists at most four due items but still reports the true count", () => {
    const many = Array.from({ length: 7 }, (_, i) => item(`m${i}`, "dp", `2026-09-0${i + 1}T00:00:00Z`));
    const s = summarizeRevisionByTopic(many, now);
    expect(s.dp.dueCount).toBe(7);
    expect(s.dp.dueItems).toHaveLength(4);
  });
});

describe("buildTopicGuidance", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  const topics = [
    makeTopic("weak-topic", { status: "Weak", masteryScore: 40 }),
    makeTopic("fresh", { status: "Recommended Next", masteryScore: null }),
    makeTopic("blocked", { status: "Postponed", masteryScore: null, prerequisites: [prereq("weak-topic", true)] }),
    makeTopic("strong-topic", { status: "Strong" }),
  ];
  const entry = (slug: string, difficulty: ProblemCatalogEntry["difficulty"], topicSlug: string): ProblemCatalogEntry => ({
    slug,
    title: slug,
    difficulty,
    topicSlugs: [topicSlug],
  });
  const catalog: ProblemCatalogEntry[] = [
    entry("weak-e1", "Easy", "weak-topic"),
    entry("weak-e2", "Easy", "weak-topic"),
    entry("weak-m1", "Medium", "weak-topic"),
    entry("fresh-e1", "Easy", "fresh"),
    entry("fresh-e2", "Easy", "fresh"),
    entry("fresh-m1", "Medium", "fresh"),
    entry("blocked-e1", "Easy", "blocked"),
    entry("strong-m1", "Medium", "strong-topic"),
    entry("strong-m2", "Medium", "strong-topic"),
    entry("strong-h1", "Hard", "strong-topic"),
  ];
  const rec = (slug: string, topicSlug: string, isRevision = false): Recommendation => ({
    problemSlug: slug,
    problemTitle: slug,
    difficulty: "Easy",
    topicSlug,
    topicName: topicSlug,
    priority: "High",
    kind: isRevision ? "revision" : "weak-topic",
    reason: `${slug} because`,
    isRevision,
  });
  const build = (overrides: Partial<Parameters<typeof buildTopicGuidance>[0]> = {}) =>
    buildTopicGuidance({
      topics,
      recommendations: [],
      catalog,
      solvedProblemSlugs: [],
      revisionItems: [],
      now,
      pool: [],
      ...overrides,
    });
  const slugsFor = (guidance: ReturnType<typeof build>, topic: string) =>
    guidance[topic].newPracticeRecommendations.problems.map((p) => p.slug);

  it("has an entry for every topic", () => {
    expect(Object.keys(build()).sort()).toEqual(topics.map((t) => t.topicSlug).sort());
  });

  it("gives every non-postponed topic new practice, with the band its status calls for", () => {
    const guidance = build();
    expect(guidance["weak-topic"].newPracticeRecommendations.band).toBe("approachable");
    expect(guidance.fresh.newPracticeRecommendations.band).toBe("approachable");
    expect(guidance["strong-topic"].newPracticeRecommendations.band).toBe("advanced");
    expect(slugsFor(guidance, "strong-topic")).toEqual(["strong-m1", "strong-m2", "strong-h1"]);
  });

  it("leads with the engine's own non-revision recommendation, keeping its reason", () => {
    const guidance = build({ recommendations: [rec("weak-e2", "weak-topic"), rec("rev", "weak-topic", true)] });
    const problems = guidance["weak-topic"].newPracticeRecommendations.problems;
    expect(problems[0]).toMatchObject({ slug: "weak-e2", source: "engine", reason: "weak-e2 because" });
    expect(problems.map((p) => p.slug)).not.toContain("rev");
  });

  it("gives an untouched, ready-to-start topic starter problems", () => {
    const problems = build().fresh.newPracticeRecommendations.problems;
    expect(problems.map((p) => p.slug)).toEqual(["fresh-e1", "fresh-e2", "fresh-m1"]);
    expect(problems[0].reason).toMatch(/starter/i);
  });

  it("gives a postponed topic no new practice — its prerequisite comes first", () => {
    expect(build().blocked.newPracticeRecommendations).toEqual({ band: null, problems: [] });
  });

  it("never suggests a problem already in the synced solve history", () => {
    const guidance = build({ solvedProblemSlugs: ["weak-e1", "fresh-e1"] });
    expect(slugsFor(guidance, "weak-topic")).not.toContain("weak-e1");
    expect(slugsFor(guidance, "fresh")).not.toContain("fresh-e1");
  });

  it("also treats a problem with a revision item as solved", () => {
    const solvedViaRevision: RevisionItemState = {
      id: "r1",
      problemSlug: "weak-e1",
      problemTitle: "weak-e1",
      difficulty: "Easy",
      topicSlug: "weak-topic",
      topicName: "weak-topic",
      intervalIndex: 0,
      dueAt: new Date("2026-10-20T00:00:00Z"),
      lastReviewedAt: null,
      lastFeedback: null,
      reviewCount: 0,
    };
    const guidance = build({ revisionItems: [solvedViaRevision] });
    expect(slugsFor(guidance, "weak-topic")).not.toContain("weak-e1");
    // …and the revision section still reports it, untouched by the new-practice logic.
    expect(guidance["weak-topic"].revision).toMatchObject({ trackedCount: 1, upcomingCount: 1, dueCount: 0 });
  });

  it("fills gaps from the supplemental pool when the catalog runs short", () => {
    const guidance = build({
      catalog: [entry("weak-e1", "Easy", "weak-topic")],
      pool: [entry("pool-e1", "Easy", "weak-topic"), entry("pool-m1", "Medium", "weak-topic")],
    });
    const problems = guidance["weak-topic"].newPracticeRecommendations.problems;
    expect(problems.map((p) => [p.slug, p.source])).toEqual([
      ["weak-e1", "catalog"],
      ["pool-e1", "pool"],
      ["pool-m1", "pool"],
    ]);
  });

  it("every topic has a revision summary, zeroed when nothing is tracked", () => {
    expect(build()["strong-topic"].revision).toMatchObject({ dueCount: 0, trackedCount: 0, dueItems: [] });
  });
});