import { describe, expect, it } from "vitest";
import { createFactRecord } from "./fact-model";
import { projectVerifiedEntries } from "./entry-projection";

describe("entry-projection", () => {
  it("aggregates only facts with canon_status verified", () => {
    const facts = [
      createFactRecord({ fact_id: "f1", canon_status: "verified" }),
      createFactRecord({ fact_id: "f2", canon_status: "candidate" }),
      createFactRecord({ fact_id: "f3", canon_status: "pending_review" }),
      createFactRecord({ fact_id: "f4", canon_status: "verified" }),
      createFactRecord({ fact_id: "f5", canon_status: "rejected" }),
    ];

    const result = projectVerifiedEntries(facts);

    expect(result).toHaveLength(2);
    expect(result.map((fact) => fact.fact_id)).toEqual(["f1", "f4"]);
  });

  it("returns an empty array when no verified facts exist", () => {
    const facts = [
      createFactRecord({ fact_id: "f1", canon_status: "candidate" }),
      createFactRecord({ fact_id: "f2", canon_status: "pending_review" }),
    ];

    const result = projectVerifiedEntries(facts);

    expect(result).toEqual([]);
  });
});
