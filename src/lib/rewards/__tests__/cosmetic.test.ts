// ================================================================
// TEST — phân loại cosmetic
// ================================================================
// VÌ SAO CÓ FILE NÀY:
//   Ràng buộc cốt lõi của hệ thống cosmetic (spec §20): cosmetic CHỈ trang
//   trí. Nếu vô tình cho `PET`/`AVATAR_FRAME` vào nhóm "dùng được trong
//   comment" hoặc nhóm "trang bị", UI sẽ cho phép hành vi sai. Các hàm ở
//   `cosmetic.ts` là nơi quyết định — test khoá lại ở đây thay vì tin rằng
//   component luôn gọi đúng.
import { describe, expect, it } from "vitest";
import {
  EQUIPPABLE_TYPES,
  displayAsset,
  isCommentUsable,
  isCosmeticType,
  isEquippable,
  parseCosmeticMetadata,
} from "@/lib/rewards/cosmetic";

describe("isCosmeticType — phân biệt cosmetic với phần thưởng thật", () => {
  it("nhận đủ 6 loại cosmetic", () => {
    for (const t of [
      "PET",
      "AVATAR_FRAME",
      "PROFILE_EFFECT",
      "CHAT_STICKER",
      "CHAT_GIF",
      "BADGE",
    ]) {
      expect(isCosmeticType(t)).toBe(true);
    }
  });

  it("KHÔNG nhận 4 loại phần thưởng có giá trị thực (đã có sẵn)", () => {
    // Nếu vô tình coi "LEARNING" là cosmetic thì UI sẽ cho trang bị hoặc
    // nhúng vào comment — sai hoàn toàn.
    for (const t of ["DIGITAL", "LEARNING", "REAL_WORLD", "MILESTONE"]) {
      expect(isCosmeticType(t)).toBe(false);
    }
  });
});

describe("isEquippable — chỉ loại trang bị lên hồ sơ", () => {
  it("PET / AVATAR_FRAME / PROFILE_EFFECT / BADGE được trang bị", () => {
    expect(isEquippable("PET")).toBe(true);
    expect(isEquippable("AVATAR_FRAME")).toBe(true);
    expect(isEquippable("PROFILE_EFFECT")).toBe(true);
    expect(isEquippable("BADGE")).toBe(true);
  });

  it("CHAT_STICKER / CHAT_GIF KHÔNG trang bị (dùng kèm trong comment)", () => {
    expect(isEquippable("CHAT_STICKER")).toBe(false);
    expect(isEquippable("CHAT_GIF")).toBe(false);
  });

  it("phần thưởng cũ không bao giờ trang bị được", () => {
    for (const t of ["LEARNING", "DIGITAL", "MILESTONE", "REAL_WORLD"]) {
      expect(isEquippable(t)).toBe(false);
    }
  });

  it("mọi loại trang bị đều phải là cosmetic trước", () => {
    // Chặn lỗi tương lai: thêm giá trị vào EQUIPPABLE_TYPES mà quên khai báo
    // nó là cosmetic.
    for (const t of EQUIPPABLE_TYPES) {
      expect(isCosmeticType(t)).toBe(true);
    }
  });
});

describe("isCommentUsable — sticker/GIF trong bình luận", () => {
  it("cho phép sticker, GIF, badge", () => {
    expect(isCommentUsable("CHAT_STICKER")).toBe(true);
    expect(isCommentUsable("CHAT_GIF")).toBe(true);
    expect(isCommentUsable("BADGE")).toBe(true);
  });

  it("KHÔNG cho pet / frame / hiệu ứng nhúng vào comment", () => {
    // Pet là hình ảnh lớn — nhúng vào comment sẽ phá layout danh sách.
    expect(isCommentUsable("PET")).toBe(false);
    expect(isCommentUsable("AVATAR_FRAME")).toBe(false);
    expect(isCommentUsable("PROFILE_EFFECT")).toBe(false);
  });
});

describe("parseCosmeticMetadata — đọc Json? an toàn", () => {
  it("metadata rác không làm vỡ UI", () => {
    // `Reward.requirements` là `Json?` — có thể null, mảng, hoặc số.
    expect(parseCosmeticMetadata(null)).toEqual({});
    expect(parseCosmeticMetadata(undefined)).toEqual({});
    expect(parseCosmeticMetadata([1, 2, 3])).toEqual({});
    // Giá trị không phải object ⇒ trả về object RỖNG, không phải bản thân giá
    // trị đó (nếu trả thẳng, mọi `meta.assetUrl` sau đó sẽ ném lỗi).
    expect(parseCosmeticMetadata("x")).toEqual({});
    expect(parseCosmeticMetadata(42)).toEqual({});
    expect(displayAsset(parseCosmeticMetadata("x"))).toBeNull();
  });

  it("đọc được metadata hợp lệ", () => {
    const meta = parseCosmeticMetadata({
      assetUrl: "/rewards/pets/cat.svg",
      width: 96,
      auraColor: "#7c6cf0",
    });
    expect(meta.assetUrl).toBe("/rewards/pets/cat.svg");
    expect(meta.auraColor).toBe("#7c6cf0");
  });
});

describe("displayAsset — ưu tiên preview, thiếu thì lùi về asset", () => {
  it("có preview thì dùng preview (nhẹ hơn cho lưới)", () => {
    expect(displayAsset({ previewUrl: "/p.svg", assetUrl: "/a.svg" })).toBe("/p.svg");
  });

  it("không có preview thì dùng asset chính", () => {
    expect(displayAsset({ assetUrl: "/a.svg" })).toBe("/a.svg");
  });

  it("không có asset nào ⇒ null (UI fallback sang icon, không render <img> rỗng)", () => {
    expect(displayAsset({})).toBeNull();
  });
});