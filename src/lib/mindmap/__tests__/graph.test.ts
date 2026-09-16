import { describe, expect, it } from "vitest";
import { parseMindMapData } from "../graph";

describe("parseMindMapData", () => {
  it("accepts an empty graph for a new blank mind map", () => {
    expect(parseMindMapData({ version: 1, nodes: [], edges: [] })).toEqual({
      version: 1,
      nodes: [],
      edges: [],
    });
  });

  it("rejects duplicate node IDs and dangling edges", () => {
    expect(
      parseMindMapData({
        nodes: [
          { id: "root", label: "Root", parentId: null },
          { id: "root", label: "Duplicate", parentId: null },
        ],
        edges: [],
      })
    ).toBeNull();

    expect(
      parseMindMapData({
        nodes: [{ id: "root", label: "Root", parentId: null }],
        edges: [{ id: "edge", source: "root", target: "missing" }],
      })
    ).toBeNull();
  });

  it("rejects cyclic parent relationships", () => {
    expect(
      parseMindMapData({
        nodes: [
          { id: "a", label: "A", parentId: "b" },
          { id: "b", label: "B", parentId: "a" },
        ],
        edges: [],
      })
    ).toBeNull();
  });
});
