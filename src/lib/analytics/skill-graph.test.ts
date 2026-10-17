import { describe, expect, it } from "vitest";
import { getAllGraphTopicSlugs, getDependents, getPrerequisites } from "@/lib/analytics/skill-graph";
import type { SkillGraphEdge } from "@/lib/analytics/types";

const EDGES: SkillGraphEdge[] = [
  {
    topicSlug: "backtracking",
    topicName: "Backtracking",
    prerequisiteSlug: "recursion",
    prerequisiteName: "Recursion",
    relationshipType: "PREREQUISITE",
    strength: 0.9,
  },
  {
    topicSlug: "sliding-window",
    topicName: "Sliding Window",
    prerequisiteSlug: "array",
    prerequisiteName: "Array",
    relationshipType: "SUBTOPIC",
    strength: 0.3, // deliberately below the default threshold
  },
];

describe("getPrerequisites", () => {
  it("returns direct prerequisites at or above the default strength threshold", () => {
    const result = getPrerequisites(EDGES, "backtracking");
    expect(result).toHaveLength(1);
    expect(result[0].prerequisiteSlug).toBe("recursion");
  });

  it("filters out edges below the strength threshold", () => {
    const result = getPrerequisites(EDGES, "sliding-window");
    expect(result).toHaveLength(0);
  });

  it("respects an explicit, lower threshold", () => {
    const result = getPrerequisites(EDGES, "sliding-window", 0.2);
    expect(result).toHaveLength(1);
  });

  it("returns an empty array for a topic with no edges at all", () => {
    expect(getPrerequisites(EDGES, "unrelated-topic")).toEqual([]);
  });
});

describe("getDependents", () => {
  it("returns topics that list the given topic as a prerequisite", () => {
    const result = getDependents(EDGES, "recursion");
    expect(result).toHaveLength(1);
    expect(result[0].topicSlug).toBe("backtracking");
  });
});

describe("getAllGraphTopicSlugs", () => {
  it("collects every slug mentioned as either side of an edge", () => {
    const result = getAllGraphTopicSlugs(EDGES);
    expect(result).toEqual(new Set(["backtracking", "recursion", "sliding-window", "array"]));
  });
});
