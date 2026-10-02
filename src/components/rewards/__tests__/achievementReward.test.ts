// ================================================================
// TEST — rewardParts (format phần thưởng thẻ thành tựu)
// ================================================================
// VÌ SAO CÓ FILE NÀY:
//   Bug thật: UI hiện "+300 XP - - +100 LXP". Nguyên nhân là component nối
//   chuỗi `+{xp} XP · +{lxp} LXP` trong MỘC text node — khi một trong hai
//   field là null/undefined/NaN thì chuỗi lộ rác, và separator vẫn hiện dù
//   chỉ có một phần. Sửa JSX sai thì test này vẫn xanh, nên phải khoá logic.
import { describe, expect, it } from "vitest";
import { rewardParts } from "@/components/rewards/AchievementCard";

/** Dựng chuỗi hiển thị giống hệt component để kiểm tra text cuối cùng. */
function render(xpReward: unknown, lxpReward: unknown): string {
  const { xp, lxp } = rewardParts({
    xpReward: xpReward as number,
    lxpReward: lxpReward as number,
  });
  const parts: string[] = [];
  if (xp !== null) parts.push(`+${xp} XP`);
  if (xp !== null && lxp !== null) parts.push("·");
  if (lxp !== null) parts.push(`+${lxp} LXP`);
  return parts.join(" ");
}

describe("rewardParts — format phần thưởng (spec §5)", () => {
  it("có cả XP và LXP → 'xp · lxp', KHÔNG có '- -'", () => {
    expect(render(300, 100)).toBe("+300 XP · +100 LXP");
    expect(render(1000, 300)).toBe("+1000 XP · +300 LXP");
    expect(render(300, 100)).not.toContain("- -");
    expect(render(300, 100)).not.toContain("null");
    expect(render(300, 100)).not.toContain("NaN");
  });

  it("chỉ có XP → KHÔNG hiện separator mồ côi", () => {
    expect(render(300, 0)).toBe("+300 XP");
    expect(render(300, 0)).not.toContain("·");
    expect(render(300, 0)).not.toContain("LXP");
  });

  it("chỉ có LXP → KHÔNG hiện separator mồ côi", () => {
    expect(render(0, 100)).toBe("+100 LXP");
    expect(render(0, 100)).not.toContain("·");
    // So khớp chính xác: "LXP" chứa chuỗi "XP" nên phải kiểm tra có
    // dạng "XP" đứng riêng (phần thưởng XP) chứ không phải `not.toContain`.
    expect(render(0, 100)).not.toMatch(/(^|[ ·])XP/);
  });

  it("dữ liệu rác (null/undefined/NaN) KHÔNG lọt ra UI", () => {
    // Đây là case sinh ra đúng chuỗi "+- - +null LXP" ở bản cũ.
    for (const bad of [null, undefined, Number.NaN]) {
      expect(render(bad, bad)).toBe("");
      expect(render(bad, bad)).not.toContain("null");
      expect(render(bad, bad)).not.toContain("NaN");
      expect(render(300, bad)).toBe("+300 XP");
      expect(render(bad, 100)).toBe("+100 LXP");
    }
  });

  it("số âm và số thực vẫn xử lý đúng", () => {
    // Âm = dữ liệu sai => loại (không hiện "+-50 XP" gây rối).
    expect(render(-50, -10)).toBe("");
    // Số thực hợp lệ vẫn hiện nguyên vẹn.
    expect(render(12.5, 3)).toBe("+12.5 XP · +3 LXP");
  });

  it("separator chỉ xuất hiện ĐÚNG 1 lần khi có cả hai", () => {
    const out = render(300, 100);
    expect(out.split("·").length - 1).toBe(1);
  });
});
