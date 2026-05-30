import { describe, expect, it, vi } from "vitest";
import { canPromoteFactToGraph, createFactRecord } from "./fact-model";
import { createInMemoryFactStore } from "./fact-store";
import type { ChapterSnapshot, IngestResult } from "./chapter-ingest";
import { createChapterPipeline } from "./chapter-pipeline";

vi.mock("./review-model", () => ({
  resolveReviewModel: () => "review-model-v1",
}));

describe("fact-model contracts", () => {
  it("allows only verified facts to graph promotion", () => {
    const verified = createFactRecord({ canon_status: "verified" });
    const pending = createFactRecord({ canon_status: "pending_review" });
    expect(canPromoteFactToGraph(verified)).toBe(true);
    expect(canPromoteFactToGraph(pending)).toBe(false);
  });
});

describe("fact-store", () => {
  it("appends fact status transitions without overwriting history", () => {
    const store = createInMemoryFactStore();
    store.append({ fact_id: "f1", from: "candidate", to: "verified", fact_batch_id: "b1" });
    store.append({ fact_id: "f1", from: "verified", to: "rejected", fact_batch_id: "b2" });
    const timeline = store.timeline("f1");
    expect(timeline).toHaveLength(2);
    expect(timeline[0].to).toBe("verified");
    expect(timeline[1].to).toBe("rejected");
  });

  it("links events by fact_batch_id", () => {
    const store = createInMemoryFactStore();
    store.append({ fact_id: "f1", from: "candidate", to: "verified", fact_batch_id: "b1" });
    store.append({ fact_id: "f2", from: "candidate", to: "verified", fact_batch_id: "b1" });
    store.append({ fact_id: "f3", from: "candidate", to: "verified", fact_batch_id: "b2" });
    const batchEvents = store.batch("b1");
    expect(batchEvents).toHaveLength(2);
    expect(batchEvents.map((event) => event.fact_id)).toEqual(["f1", "f2"]);
  });
});

describe("chapter-pipeline", () => {
  it("forwards project and chapter path to injected ingest function", async () => {
    const calls: Array<{ projectPath: string; chapterPath: string }> = [];
    const expected: ChapterSnapshot = {
      chapterId: "chapter-1",
      chapterNumber: 1,
      summary: "s",
      characters: [],
      locations: [],
      organizations: [],
      items: [],
      events: [],
      characterStateChanges: [],
      relationshipChanges: [],
      knowledgeChanges: [],
      foreshadowingChanges: [],
      newCanonFacts: [],
      timelineEvents: [],
      conflicts: [],
      endingHook: "",
      graphNodes: [],
      graphEdges: [],
    };
    const pipeline = createChapterPipeline({
      ingestChapter: async (projectPath, chapterPath, reviewModel) => {
        calls.push({ projectPath, chapterPath });
        expect(reviewModel).toBe("review-model-v1");
        return { snapshot: expected };
      },
    });

    const result = await pipeline("/project", "/project/ch-1.md");

    expect(calls).toEqual([{ projectPath: "/project", chapterPath: "/project/ch-1.md" }]);
    expect(result.snapshot).toBe(expected);
  });

  it("forwards resolved review model to injected ingest function", async () => {
    const { createChapterPipeline: createPipeline } = await import("./chapter-pipeline");
    const ingestSpy = vi.fn(async () => ({ snapshot: null }) as IngestResult);
    const pipeline = createPipeline({ ingestChapter: ingestSpy });

    await pipeline("/project", "/project/ch-2.md");

    expect(ingestSpy).toHaveBeenCalledTimes(1);
    expect(ingestSpy).toHaveBeenCalledWith("/project", "/project/ch-2.md", "review-model-v1");
  });

  it("propagates errors from injected ingest function", async () => {
    const ingestError = new Error("ingest failed");
    const { createChapterPipeline: createPipeline } = await import("./chapter-pipeline");
    const ingestSpy = vi.fn(async () => {
      throw ingestError;
    });
    const pipeline = createPipeline({ ingestChapter: ingestSpy });

    await expect(pipeline("/project", "/project/ch-3.md")).rejects.toThrow("ingest failed");
    expect(ingestSpy).toHaveBeenCalledWith("/project", "/project/ch-3.md", "review-model-v1");
  });
});
