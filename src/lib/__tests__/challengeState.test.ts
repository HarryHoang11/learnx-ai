// ================================================================
// TEST — buildChallengeState (logic trạng thái thử thách ngày)
// ================================================================
// VÌ SAO CÓ FILE NÀY:
//   Bug thật: challenge 0/5 lại hiện "Đã hoàn thành!" vì UI đọc cột boolean
//   `completed` (server set) thay vì so sánh `completedCount >= targetCount`.
//   `buildChallengeState` là nơi duy nhất quyết định trạng thái, nên đây là
//   chỗ đúng nhất để khoá lại hành vi — sửa JSX sai thì test này vẫn xanh.
//
// 4 case dưới đây map đúng 4 case bắt buộc trong spec §23.
import { describe, expect, it } from "vitest";
import { buildChallengeState, type DailyChallengeData } from "@/types";

/** Tạo challenge tối thiểu — chỉ 3 field mà `buildChallengeState` đọc. */
function challenge(
  targetCount: number,
  completedCount: number,
  claimed = false
): Pick<DailyChallengeData, "targetCount" | "completedCount" | "claimed"> {
  return { targetCount, completedCount, claimed };
}

describe("buildChallengeState — spec §23", () => {
  // ---- Case 1: target = 5, completed = 0 ----
  it("Case 1 — 0/5: CHƯA hoàn thành, còn 5, 0%", () => {
    const s = buildChallengeState(challenge(5, 0));
    expect(s).toEqual({
      target: 5,
      completed: 0,
      remaining: 5,
      percent: 0,
      isCompleted: false, // <- lỗi cũ: bản này là TRUE
      isClaimed: false,
      hasTarget: true,
    });
  });

  // ---- Case 2: target = 5, completed = 3 ----
  it("Case 2 — 3/5: CHƯA hoàn thành, còn 2, 60%", () => {
    const s = buildChallengeState(challenge(5, 3));
    expect(s).toEqual({
      target: 5,
      completed: 3,
      remaining: 2,
      percent: 60,
      isCompleted: false,
      isClaimed: false,
      hasTarget: true,
    });
  });

  // ---- Case 3: target = 5, completed = 5 ----
  it("Case 3 — 5/5: ĐÃ hoàn thành, còn 0, 100%", () => {
    const s = buildChallengeState(challenge(5, 5));
    expect(s).toEqual({
      target: 5,
      completed: 5,
      remaining: 0,
      percent: 100,
      isCompleted: true,
      isClaimed: false,
      hasTarget: true,
    });
  });

  // ---- Case 4: target = 5, completed = 7 (vượt) ----
  it("Case 4 — 7/5: normalize về 5/5 và ĐÃ hoàn thành (không hiện 7/5)", () => {
    const s = buildChallengeState(challenge(5, 7));
    expect(s?.completed).toBe(5);
    expect(s?.remaining).toBe(0);
    expect(s?.percent).toBe(100);
    expect(s?.isCompleted).toBe(true);
  });

  // ---- Phân biệt "đã nhận thưởng" với "đã hoàn thành" (spec §12) ----
  it("isClaimed và isCompleted là 2 trạng thái ĐỘC LẬP", () => {
    const doneNotClaimed = buildChallengeState(challenge(5, 5, false));
    expect(doneNotClaimed?.isCompleted).toBe(true);
    expect(doneNotClaimed?.isClaimed).toBe(false);

    const claimed = buildChallengeState(challenge(5, 5, true));
    expect(claimed?.isCompleted).toBe(true);
    expect(claimed?.isClaimed).toBe(true);

    // Ngược lại: KHÔNG thể đã nhận thưởng khi chưa hoàn thành.
    const impossible = buildChallengeState(challenge(5, 2, true));
    expect(impossible?.isCompleted).toBe(false);
  });
});

describe("buildChallengeState — dữ liệu rác (spec §16, §22)", () => {
  it("null => null (UI hiện empty state, không render số 0/0)", () => {
    expect(buildChallengeState(null)).toBeNull();
  });

  it("target <= 0 => KHÔNG hoàn thành (tránh '0 >= 0' báo oan)", () => {
    // Đây là case dễ sót: nếu chỉ so `completed >= target` thì 0 >= 0 là true.
    expect(buildChallengeState(challenge(0, 0))?.isCompleted).toBe(false);
    expect(buildChallengeState(challenge(-3, 5))?.isCompleted).toBe(false);
  });

  it("target <= 0 => hasTarget = false để UI không render '0 bài tập'", () => {
    expect(buildChallengeState(challenge(0, 0))?.hasTarget).toBe(false);
  });

  it("không sinh NaN khi field là NaN/undefined (tránh lọt chuỗi rác ra UI)", () => {
    const s = buildChallengeState({
      targetCount: Number.NaN,
      completedCount: Number.NaN,
      claimed: false,
    });
    expect(s).toEqual({
      target: 0,
      completed: 0,
      remaining: 0,
      percent: 0,
      isCompleted: false,
      isClaimed: false,
      hasTarget: false,
    });
    // Quan trọng: không field nào là NaN (NaN lọt ra UI thành chữ "NaN").
    expect(Object.values(s!).every((v) => typeof v !== "number" || Number.isFinite(v))).toBe(true);
  });

  it("mọi giá trị trả về đều là số hữu hạn và không âm", () => {
    const s = buildChallengeState(challenge(3, 99));
    expect(Number.isFinite(s?.percent)).toBe(true);
    expect(s?.remaining).toBeGreaterThanOrEqual(0);
    expect(s?.completed).toBeGreaterThanOrEqual(0);
  });
});
