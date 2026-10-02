// ================================================================
// TEST — taxonomy chủ đề cho form tải tài liệu cộng đồng
// ================================================================
// VÌ SAO CÓ FILE NÀY:
//   Bug thật: UI chỉ đọc `subject.topics`, bỏ rơi `children` mà API trả về
//   (`GET /api/community/subjects?includeTopics=true` có `include: children`).
//   ⇒ chuyên đề con như "Python", "C++" không bao giờ hiện được, người dùng bị
//   ép chọn topic cha không liên quan hoặc bỏ trống.
//   Đồng thời form KHÔNG được tự chọn sẵn topic: tài liệu "Cân bằng hóa học"
//   sẽ bị gán cứng "Hóa học vô cơ" nếu auto-select phần tử đầu.
import { describe, expect, it } from "vitest";
import {
  flattenTopicOptions,
  shouldOfferGeneralTopic,
  type RawTopic,
} from "@/lib/community/topicOptions";

/** Dữ liệu thật lấy từ `prisma/seed/subjects.ts` (môn "Tin học"). */
const TIN_HOC: RawTopic[] = [
  {
    id: "t-lap-trinh",
    name: "Lập trình",
    children: [
      { id: "t-cpp", name: "C++" },
      { id: "t-python", name: "Python" },
      { id: "t-java", name: "Java" },
    ],
  },
  { id: "t-ctdl", name: "Cấu trúc dữ liệu và giải thuật" },
];

/** Dữ liệu thật lấy từ `prisma/seed/subjects.ts` (môn "Hóa học", 4 topic). */
const HOA_HOC: RawTopic[] = [
  { id: "h-vo-co", name: "Hóa học vô cơ" },
  { id: "h-huu-co", name: "Hóa học hữu cơ" },
  { id: "h-phan-tich", name: "Hóa học phân tích" },
  { id: "hoa-ly", name: "Hóa lý" },
];

describe("flattenTopicOptions — phải hiện CẢ tầng children", () => {
  it("làm phẳng topic gốc + children theo thứ tự", () => {
    const opts = flattenTopicOptions(TIN_HOC);
    expect(opts.map((o) => o.label)).toEqual([
      "Lập trình",
      "└ C++",
      "└ Python",
      "└ Java",
      "Cấu trúc dữ liệu và giải thuật",
    ]);
    expect(opts.map((o) => o.depth)).toEqual([0, 1, 1, 1, 0]);
  });

  it("id của child dùng được để gửi topicId", () => {
    const opts = flattenTopicOptions(TIN_HOC);
    // Đây là điều bản cũ làm hỏng: "Python" không bao giờ xuất hiện nên không
    // thể gán đúng topicId cho tài liệu về Python.
    expect(opts.some((o) => o.id === "t-python")).toBe(true);
    expect(opts.find((o) => o.id === "t-python")?.label).toBe("└ Python");
  });

  it("môn không có children vẫn ra đúng danh sách", () => {
    const opts = flattenTopicOptions(HOA_HOC);
    expect(opts).toHaveLength(4);
    expect(opts.every((o) => o.depth === 0)).toBe(true);
    // KHÔNG tự chọn: mốc rỗng mặc định vẫn là "Tổng hợp", không phải topic[0].
    expect(opts[0].label).toBe("Hóa học vô cơ");
  });

  it("dữ liệu thiếu/không hợp lệ không làm vỡ UI", () => {
    expect(flattenTopicOptions(null)).toEqual([]);
    expect(flattenTopicOptions(undefined)).toEqual([]);
    expect(flattenTopicOptions([])).toEqual([]);
    // API có thể trả `children: null` khi topic không có con.
    const opts = flattenTopicOptions([{ id: "a", name: "A", children: null }]);
    expect(opts).toEqual([{ id: "a", label: "A", depth: 0 }]);
    // Phần tử rác bị bỏ qua thay vì ném lỗi làm sập trang.
    const mixed = flattenTopicOptions([
      { id: "a", name: "A" },
      null,
      undefined,
      { id: "", name: "Không id" },
    ] as unknown as RawTopic[]);
    expect(mixed.map((o) => o.id)).toEqual(["a"]);
  });

  it("giữ nguyên thứ tự do API/seed quy định (không tự sort)", () => {
    const opts = flattenTopicOptions(HOA_HOC);
    // "Hóa lý" là `order: 4` trong seed ⇒ phải ở cuối, không bị sort theo tên.
    expect(opts[opts.length - 1].id).toBe("hoa-ly");
    expect(opts[0].id).toBe("h-vo-co");
  });
});

describe("shouldOfferGeneralTopic — mốc 'Tổng hợp'", () => {
  it("môn có nhiều topic ⇒ hiện lựa chọn Tổng hợp", () => {
    expect(shouldOfferGeneralTopic(HOA_HOC)).toBe(true);
    expect(shouldOfferGeneralTopic(TIN_HOC)).toBe(true);
  });

  it("môn chỉ có 1 topic ⇒ KHÔNG ép Tổng hợp (chọn topic đó không sai)", () => {
    expect(shouldOfferGeneralTopic([{ id: "a", name: "A" }])).toBe(false);
  });

  it("chưa chọn môn / danh sách rỗng ⇒ không hiện", () => {
    expect(shouldOfferGeneralTopic(null)).toBe(false);
    expect(shouldOfferGeneralTopic([])).toBe(false);
  });
});
