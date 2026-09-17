// ================================================================
// APPLY MASTERY TO PLAN — logic thuần, không đụng DB
// ================================================================
// Mạch tư duy: đây chính là mảnh còn thiếu được ghi rõ trong TODO cũ
// của generateRoadmap() — "khi học sinh hoàn thành 1 topic ... gọi
// lại để AI đẩy sớm topic tháng sau". Thay vì gọi lại AI (tốn kém,
// không cần thiết — chỉ là đổi trạng thái topic đã có sẵn), hàm THUẦN
// này nhận plan hiện tại + 1 topic vừa đạt ngưỡng mastery, rồi:
//   1. Đánh dấu "done" cho đúng topic đó (so khớp không phân biệt
//      hoa/thường, khớp cách roadmap.service dùng ở getGoalGap).
//   2. Nếu NHỜ VẬY mà cả tháng đã "done" hết, tự mở khoá tháng kế
//      tiếp (locked -> current) — đây là phần "Roadmap tự cập nhật"
//      trong flow gốc, KHÔNG cần gọi AI lại.
// Tách riêng khỏi roadmap.service.ts để test được mà không cần mock
// Prisma (cùng pattern với groupWeakConcepts.ts / mindmap/graph.ts).
// ================================================================

import type { RoadmapPlan } from "@/types";

export interface ApplyMasteryResult {
  plan: RoadmapPlan[];
  changed: boolean;
  // Tên tháng vừa được mở khoá (nếu có) — để service/route có thể trả
  // về cho UI hiển thị thông báo "Tháng X đã mở khoá!" thay vì chỉ
  // im lặng cập nhật.
  unlockedMonth: number | null;
}

function monthLabel(monthNumber: number, isCurrent: boolean): string {
  return isCurrent ? `Tháng ${monthNumber} — đang học` : `Tháng ${monthNumber}`;
}

export function applyMasteryToPlan(
  plan: RoadmapPlan[],
  topicName: string,
  masteryPercent: number,
  masteryThreshold: number
): ApplyMasteryResult {
  if (masteryPercent < masteryThreshold) {
    return { plan, changed: false, unlockedMonth: null };
  }

  const topicLower = topicName.toLowerCase();
  let changed = false;

  // Bước 1: đánh dấu "done" cho đúng topic vừa đạt ngưỡng, ở MỌI
  // tháng nó xuất hiện (hiếm khi 1 topic lặp ở nhiều tháng, nhưng xử
  // lý cho chắc thay vì giả định chỉ có 1 chỗ).
  let next = plan.map((month) => ({
    ...month,
    topics: month.topics.map((t) => {
      if (t.name.toLowerCase() === topicLower && t.status !== "done") {
        changed = true;
        return { ...t, status: "done" as const };
      }
      return t;
    }),
  }));

  if (!changed) {
    // Topic không nằm trong plan này, hoặc đã "done" từ trước —
    // không có gì để cập nhật, không cần dò tiếp việc mở khoá tháng.
    return { plan, changed: false, unlockedMonth: null };
  }

  // Bước 2: dò từ tháng nhỏ nhất — hễ 1 tháng "done" toàn bộ VÀ tháng
  // kế tiếp còn "locked", mở khoá tháng kế tiếp. Dùng vòng lặp (không
  // chỉ if đơn) để xử lý trường hợp hiếm: 1 topic hoàn thành làm
  // "domino" mở khoá liên tiếp nhiều tháng (vd tháng kế tiếp chỉ có
  // đúng 1 topic và nó trùng tên với topic vừa hoàn thành ở tháng này).
  const sortedByMonth = [...next].sort((a, b) => a.month - b.month);
  let unlockedMonth: number | null = null;
  for (let i = 0; i < sortedByMonth.length - 1; i++) {
    const current = sortedByMonth[i];
    const upcoming = sortedByMonth[i + 1];
    const currentAllDone = current.topics.length > 0 && current.topics.every((t) => t.status === "done");
    const upcomingLocked = upcoming.topics.some((t) => t.status === "locked");
    if (currentAllDone && upcomingLocked) {
      upcoming.topics = upcoming.topics.map((t) => (t.status === "locked" ? { ...t, status: "current" as const } : t));
      upcoming.label = monthLabel(upcoming.month, true);
      unlockedMonth = unlockedMonth ?? upcoming.month;
      changed = true;
    }
  }
  next = sortedByMonth;

  return { plan: next, changed, unlockedMonth };
}
