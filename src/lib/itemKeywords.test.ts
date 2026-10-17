import { describe, expect, it } from "vitest";
import { parseItemKeywords, buildItemKeywordWhere } from "./itemKeywords";

describe("itemKeywords", () => {
  describe("parseItemKeywords", () => {
    it("returns empty array for empty or whitespace string", () => {
      expect(parseItemKeywords("")).toEqual([]);
      expect(parseItemKeywords("   ")).toEqual([]);
      expect(parseItemKeywords(null)).toEqual([]);
      expect(parseItemKeywords(undefined)).toEqual([]);
    });

    it("parses single keyword", () => {
      expect(parseItemKeywords("robot")).toEqual(["robot"]);
      expect(parseItemKeywords("  ufone  ")).toEqual(["ufone"]);
    });

    it("parses multi-keyword with + sign", () => {
      expect(parseItemKeywords("ufone+robot")).toEqual(["ufone", "robot"]);
      expect(parseItemKeywords("ufone + robot + vivo")).toEqual(["ufone", "robot", "vivo"]);
    });

    it("parses multi-keyword with comma", () => {
      expect(parseItemKeywords("ufone, robot")).toEqual(["ufone", "robot"]);
    });

    it("expands uime into ui me and vice versa", () => {
      const parsed = parseItemKeywords("ufone+uime");
      expect(parsed).toContain("ufone");
      expect(parsed).toContain("uime");
      expect(parsed).toContain("ui me");
    });

    it("expands powerbank into power bank and vice versa", () => {
      const parsed = parseItemKeywords("powerbank+kabel");
      expect(parsed).toContain("powerbank");
      expect(parsed).toContain("power bank");
      expect(parsed).toContain("kabel");
    });
  });

  describe("buildItemKeywordWhere", () => {
    it("returns empty object for empty keyword", () => {
      expect(buildItemKeywordWhere("")).toEqual({});
      expect(buildItemKeywordWhere(null)).toEqual({});
    });

    it("returns single contains condition when 1 keyword and no expansion", () => {
      expect(buildItemKeywordWhere("robot")).toEqual({
        name: { contains: "robot", mode: "insensitive" },
      });
    });

    it("returns OR condition when multiple keywords are given", () => {
      const where = buildItemKeywordWhere("ufone+robot");
      expect(where).toEqual({
        OR: [
          { name: { contains: "ufone", mode: "insensitive" } },
          { name: { contains: "robot", mode: "insensitive" } },
        ],
      });
    });

    it("returns OR condition with aliases for ufone+uime", () => {
      const where = buildItemKeywordWhere("ufone+uime");
      expect(where.OR).toBeDefined();
      expect(where.OR?.length).toBe(3);
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { name: { contains: "ufone", mode: "insensitive" } },
          { name: { contains: "uime", mode: "insensitive" } },
          { name: { contains: "ui me", mode: "insensitive" } },
        ])
      );
    });
  });
});
