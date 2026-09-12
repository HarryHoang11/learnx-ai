// Unit test cho i18n core: normalize + dictionary đầy đủ 2 ngôn ngữ.
import { describe, expect, it } from "vitest";
import { normalizeLanguage, translate, type I18nKey } from "../dictionary";

describe("normalizeLanguage", () => {
  it("chỉ nhận vi/en, còn lại về vi", () => {
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage("vi")).toBe("vi");
    expect(normalizeLanguage("fr")).toBe("vi");
    expect(normalizeLanguage(null)).toBe("vi");
    expect(normalizeLanguage(undefined)).toBe("vi");
  });
});

describe("translate", () => {
  it("mọi key đều có bản dịch khác rỗng ở cả 2 ngôn ngữ", () => {
    const keys: I18nKey[] = [
      "nav.dashboard",
      "nav.calendar",
      "nav.roadmap",
      "nav.practice",
      "nav.diagnostic",
      "nav.tutor",
      "nav.progress",
      "nav.friends",
      "nav.leaderboard",
      "nav.community",
      "nav.library",
      "nav.resources",
      "nav.mindmap",
      "nav.profile",
      "topbar.logout",
      "common.retry",
    ];
    for (const key of keys) {
      expect(translate("vi", key).length).toBeGreaterThan(0);
      expect(translate("en", key).length).toBeGreaterThan(0);
    }
  });
});
