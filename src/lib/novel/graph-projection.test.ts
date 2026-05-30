import { describe, expect, it } from "vitest";
import { createFactRecord } from "./fact-model";
import { projectActiveEdges } from "./graph-projection";

describe("graph-projection", () => {
  it("generates active edges only from verified facts", () => {
    const facts = [
      createFactRecord({
        fact_id: "f1",
        subject_id: "character:lin",
        predicate: "ALLY_OF",
        object_id_or_value: "character:mu",
        canon_status: "verified",
      }),
      createFactRecord({
        fact_id: "f2",
        subject_id: "character:lin",
        predicate: "KNOWS",
        object_id_or_value: "character:chen",
        canon_status: "candidate",
      }),
      createFactRecord({
        fact_id: "f3",
        subject_id: "character:ye",
        predicate: "ENEMY_OF",
        object_id_or_value: "character:mu",
        canon_status: "verified",
      }),
    ];

    const activeEdges = projectActiveEdges(facts);

    expect(activeEdges).toEqual([
      {
        fact_id: "f1",
        source: "character:lin",
        relation: "ALLY_OF",
        target: "character:mu",
        active: true,
      },
      {
        fact_id: "f3",
        source: "character:ye",
        relation: "ENEMY_OF",
        target: "character:mu",
        active: true,
      },
    ]);
  });

  it("returns empty array when no verified facts", () => {
    const facts = [
      createFactRecord({ canon_status: "candidate" }),
      createFactRecord({ canon_status: "pending_review" }),
      createFactRecord({ canon_status: "rejected" }),
    ];

    expect(projectActiveEdges(facts)).toEqual([]);
  });
});
