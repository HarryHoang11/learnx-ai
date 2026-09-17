import { describe, expect, it } from "vitest";
import { applyMasteryToPlan } from "../applyMasteryToPlan";
import type { RoadmapPlan } from "@/types";

function samplePlan(): RoadmapPlan[] {
  return [
    {
      month: 1,
      label: "Tháng 1 — đang học",
      topics: [
        { name: "Giới hạn", status: "current" },
        { name: "Đạo hàm", status: "current" },
      ],
    },
    {
      month: 2,
      label: "Tháng 2",
      topics: [{ name: "Tích phân", status: "locked" }],
    },
  ];
}

const THRESHOLD = 80;

describe("applyMasteryToPlan", () => {
  it("không đổi gì nếu mastery chưa đạt ngưỡng", () => {
    const result = applyMasteryToPlan(samplePlan(), "Giới hạn", 60, THRESHOLD);
    expect(result.changed).toBe(false);
    expect(result.plan[0].topics[0].status).toBe("current");
  });

  it("đánh dấu done cho đúng topic khi đạt ngưỡng (không phân biệt hoa/thường)", () => {
    const result = applyMasteryToPlan(samplePlan(), "giới hạn", 85, THRESHOLD);
    expect(result.changed).toBe(true);
    const topic = result.plan[0].topics.find((t) => t.name === "Giới hạn");
    expect(topic?.status).toBe("done");
  });

  it("KHÔNG mở khoá tháng kế tiếp nếu tháng hiện tại còn topic chưa done", () => {
    const result = applyMasteryToPlan(samplePlan(), "Giới hạn", 90, THRESHOLD);
    expect(result.plan[1].topics[0].status).toBe("locked");
    expect(result.unlockedMonth).toBeNull();
  });

  it("mở khoá tháng kế tiếp khi tháng hiện tại đã done toàn bộ", () => {
    const plan = samplePlan();
    plan[0].topics[0].status = "done"; // Giới hạn đã done từ trước
    const result = applyMasteryToPlan(plan, "Đạo hàm", 90, THRESHOLD);
    expect(result.changed).toBe(true);
    expect(result.unlockedMonth).toBe(2);
    expect(result.plan[1].topics[0].status).toBe("current");
    expect(result.plan[1].label).toBe("Tháng 2 — đang học");
  });

  it("không đổi gì nếu topic không tồn tại trong plan", () => {
    const result = applyMasteryToPlan(samplePlan(), "Không tồn tại", 95, THRESHOLD);
    expect(result.changed).toBe(false);
    expect(result.unlockedMonth).toBeNull();
  });

  it("không đổi gì nếu topic đã done từ trước (idempotent)", () => {
    const plan = samplePlan();
    plan[0].topics[0].status = "done";
    const result = applyMasteryToPlan(plan, "Giới hạn", 95, THRESHOLD);
    expect(result.changed).toBe(false);
  });
});
