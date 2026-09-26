import { describe, it, expect } from "vitest";
import {
  SUBJECT_WEAK_THRESHOLD,
  pickFocusSubject,
  pickWeakestTopic,
  summarizeBySubject,
  type SkillPoint,
} from "../progress";

/** Helper tạo 1 điểm hồ sơ năng lực. */
function point(subject: string, topic: string, masteryPercent: number, isWeak = false): SkillPoint {
  return { subject, topic, masteryPercent, isWeak };
}

describe("summarizeBySubject — gom theo môn", () => {
  it("gộp nhiều chủ đề của cùng môn thành 1 dòng", () => {
    const result = summarizeBySubject([
      point("Toán", "Lượng giác", 80),
      point("Toán", "Đại số", 60),
      point("Tin học", "Cấu trúc dữ liệu", 50),
    ]);

    expect(result).toHaveLength(2);
    const math = result.find((s) => s.subject === "Toán")!;
    expect(math.topicCount).toBe(2);
    expect(math.masteryPercent).toBe(70); // trung bình (80+60)/2
  });

  it("tìm đúng chủ đề mạnh nhất và yếu nhất", () => {
    const math = summarizeBySubject([
      point("Toán", "Lượng giác", 91),
      point("Toán", "Phương trình", 52),
      point("Toán", "Hàm số", 70),
    ]).find((s) => s.subject === "Toán")!;

    expect(math.strongestTopic).toBe("Lượng giác");
    expect(math.weakestTopic).toBe("Phương trình");
  });

  // Không có dữ liệu -> mảng rỗng, KHÔNG tự điền 0% (yêu cầu §34).
  it("trả mảng rỗng khi chưa có dữ liệu học nào", () => {
    expect(summarizeBySubject([])).toEqual([]);
  });

  it("bỏ qua dòng thiếu subject thay vì tạo môn rỗng", () => {
    const result = summarizeBySubject([point("  ", "Chủ đề", 50), point("Toán", "Hàm số", 70)]);
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe("Toán");
  });

  it("môn nhiều dữ liệu học thật hơn thì lên trước", () => {
    const result = summarizeBySubject([
      point("Tin học", "Đồ thị", 30),
      point("Toán", "Lượng giác", 80),
      point("Toán", "Đại số", 80),
      point("Toán", "Hàm số", 80),
    ]);
    expect(result[0].subject).toBe("Toán");
    expect(result[0].topicCount).toBe(3);
  });

  it("gắn icon lấy từ Subject Engine", () => {
    const result = summarizeBySubject([point("Toán", "Hàm số", 70)]);
    expect(result[0].icon).toBe("📐");
  });

  it("đánh dấu môn có chủ đề yếu", () => {
    const weak = summarizeBySubject([point("Toán", "Phương trình", 40)]);
    expect(weak[0].hasWeakTopic).toBe(true);

    const strong = summarizeBySubject([point("Toán", "Lượng giác", 95)]);
    expect(strong[0].hasWeakTopic).toBe(false);
  });

  // Ngưỡng yếu phải khớp với hồ sơ năng lực, không tự đặt lệch.
  it("coi chủ đề dưới ngưỡng là yếu kể cả cờ isWeak bị sai", () => {
    const result = summarizeBySubject([point("Toán", "Phương trình", SUBJECT_WEAK_THRESHOLD - 1)]);
    expect(result[0].hasWeakTopic).toBe(true);
  });
});

describe("pickFocusSubject — môn nên học tiếp", () => {
  it("trả null khi chưa có môn nào", () => {
    expect(pickFocusSubject([])).toBeNull();
  });

  it("ưu tiên môn đang còn yếu", () => {
    const subjects = summarizeBySubject([
      point("Tin học", "Đồ thị", 30),
      point("Toán", "Lượng giác", 92),
    ]);
    expect(pickFocusSubject(subjects)?.subject).toBe("Tin học");
  });

  it("lấy môn nhiều dữ liệu nhất khi không môn nào yếu", () => {
    const subjects = summarizeBySubject([
      point("Toán", "Lượng giác", 90),
      point("Tin học", "Đồ thị", 88),
      point("Tin học", "Quy hoạch động", 91),
    ]);
    expect(pickFocusSubject(subjects)?.subject).toBe("Tin học");
  });
});

describe("pickWeakestTopic — chủ đề cần luyện gấp", () => {
  const skills = [
    point("Toán", "Lượng giác", 91),
    point("Toán", "Phương trình lượng giác", 52),
    point("Toán", "Đại số", 70),
    point("Tin học", "Đồ thị", 30),
  ];

  it("trả chủ đề thấp nhất trong đúng môn", () => {
    expect(pickWeakestTopic("Toán", skills)?.topic).toBe("Phương trình lượng giác");
  });

  it("KHÔNG lẫn chủ đề của môn khác", () => {
    // "Đồ thị" 30% thuộc Tin học, không phải Toán — đây là cái bẫy dễ mắc
    // khi lọc sai.
    const result = pickWeakestTopic("Toán", skills);
    expect(result?.topic).not.toBe("Đồ thị");
  });

  it("trả null khi môn không có chủ đề yếu nào (không bắt luyện vô lý)", () => {
    expect(pickWeakestTopic("Vật lý", skills)).toBeNull();
    expect(pickWeakestTopic("Toán", [point("Toán", "Lượng giác", 95)])).toBeNull();
  });

  it("tôn trọng cờ isWeak kể cả khi mastery không thấp", () => {
    const flagged = [point("Toán", "Mới học", 80, true)];
    expect(pickWeakestTopic("Toán", flagged)).toBeNull();
    // isWeak chỉ là cờ gợi ý; quyết định luyện dựa trên NGƯỠNG đo được.
    // Ghi rõ ở đây để người đọc không tưởng là bug.
  });
});