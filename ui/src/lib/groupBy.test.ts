import { describe, expect, it } from "vitest";
import { groupBy } from "./groupBy.js";

describe("groupBy", () => {
  it("groups items by the key function result", () => {
    const items = [
      { type: "a", value: 1 },
      { type: "b", value: 2 },
      { type: "a", value: 3 },
    ];
    const result = groupBy(items, (item) => item.type);
    expect(result["a"]).toEqual([
      { type: "a", value: 1 },
      { type: "a", value: 3 },
    ]);
    expect(result["b"]).toEqual([{ type: "b", value: 2 }]);
  });

  it("returns an empty object for an empty array", () => {
    expect(groupBy([], (x: string) => x)).toEqual({});
  });

  it("puts all items in one group when all keys match", () => {
    const items = ["x", "x", "x"];
    const result = groupBy(items, (x) => x);
    expect(result["x"]).toHaveLength(3);
  });

  it("each item appears in exactly one group", () => {
    const items = [1, 2, 3, 4, 5];
    const result = groupBy(items, (n) => (n % 2 === 0 ? "even" : "odd"));
    expect(result["even"]).toEqual([2, 4]);
    expect(result["odd"]).toEqual([1, 3, 5]);
  });

  it("preserves insertion order within each group", () => {
    const items = ["c", "a", "b", "a", "c"];
    const result = groupBy(items, (x) => x);
    expect(result["a"]).toEqual(["a", "a"]);
    expect(result["c"]).toEqual(["c", "c"]);
  });

  it("works with numeric key functions", () => {
    const items = [10, 20, 15, 25];
    const result = groupBy(items, (n) => String(Math.floor(n / 10)));
    expect(result["1"]).toEqual([10, 15]);
    expect(result["2"]).toEqual([20, 25]);
  });

  it("does not mutate the input array", () => {
    const items = [{ id: "1" }, { id: "2" }];
    const copy = [...items];
    groupBy(items, (x) => x.id);
    expect(items).toEqual(copy);
  });
});
