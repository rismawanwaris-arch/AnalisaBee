import { describe, expect, it } from "vitest";
import { ALL_SIDEBAR_MENUS, REQUIRED_MENU_HREFS, SIDEBAR_MENU_GROUPS } from "./sidebarMenus";

describe("sidebarMenus", () => {
  it("contains no duplicate hrefs across all menu items", () => {
    const hrefs = ALL_SIDEBAR_MENUS.map((m) => m.href);
    const uniqueHrefs = new Set(hrefs);
    expect(uniqueHrefs.size).toBe(hrefs.length);
  });

  it("locks /settings as required so admin cannot hide it", () => {
    expect(REQUIRED_MENU_HREFS.has("/settings")).toBe(true);
    const settingsMenu = ALL_SIDEBAR_MENUS.find((m) => m.href === "/settings");
    expect(settingsMenu?.required).toBe(true);
  });

  it("organizes items into valid groups", () => {
    expect(SIDEBAR_MENU_GROUPS.length).toBeGreaterThanOrEqual(4);
    for (const group of SIDEBAR_MENU_GROUPS) {
      expect(group.name).toBeTruthy();
      expect(group.items.length).toBeGreaterThan(0);
      for (const item of group.items) {
        expect(item.href.startsWith("/")).toBe(true);
        expect(item.label).toBeTruthy();
      }
    }
  });
});
