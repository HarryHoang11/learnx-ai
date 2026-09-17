// ================================================================
// GROUP WEAK CONCEPTS — logic thuần, không đụng DB
// ================================================================
// Mạch tư duy: mistake-analysis.service.ts chỉ lo query Prisma rồi
// gọi hàm này để gộp/sắp xếp. Tách riêng để unit test được (dự án
// hiện không mock Prisma ở bất kỳ test nào — logic đụng DB được xác
// nhận qua typecheck + kiểm thử thủ công, còn logic THUẦN thì luôn
// có test riêng, xem cùng pattern ở src/lib/mindmap/graph.ts).
// ================================================================

export interface MistakeLogRow {
  id: string;
  userId: string;
  subject: string;
  topic: string;
  questionText: string;
  selectedAnswer: string;
  correctAnswer: string;
  explanation: string | null;
  sourceDocumentId: string | null;
  createdAt: Date;
}

export interface WeakConcept {
  subject: string;
  topic: string;
  mistakeCount: number;
  lastMistakeAt: string;
  // Ví dụ cụ thể gần nhất để hiển thị "Bạn đang sai ..." thay vì chỉ
  // số liệu khô khan.
  exampleQuestion: string;
  exampleExplanation: string | null;
  // Nếu đa số lỗi tới từ cùng 1 nguồn tài liệu, giữ lại để Targeted
  // Practice sinh câu hỏi bám sát đúng nguồn đó thay vì generic.
  sourceDocumentId: string | null;
}

// Gộp mistake theo (subject, topic), sắp xếp topic sai NHIỀU NHẤT lên
// đầu — đây chính là input cho nút "Targeted Practice". Giả định
// `mistakes` đã được query sort desc theo createdAt (item [0] trong
// mỗi nhóm là lỗi gần nhất).
export function groupIntoWeakConcepts(mistakes: MistakeLogRow[], limit = 5): WeakConcept[] {
  const bySubjectTopic = new Map<
    string,
    { subject: string; topic: string; items: MistakeLogRow[] }
  >();

  for (const mistake of mistakes) {
    const key = `${mistake.subject}::${mistake.topic}`;
    const bucket = bySubjectTopic.get(key);
    if (bucket) bucket.items.push(mistake);
    else bySubjectTopic.set(key, { subject: mistake.subject, topic: mistake.topic, items: [mistake] });
  }

  return [...bySubjectTopic.values()]
    .map(({ subject, topic, items }) => {
      const latest = items[0];
      // sourceDocumentId chỉ giữ khi ĐA SỐ lỗi cùng 1 nguồn — tránh
      // trộn lẫn nguồn của những lần luyện khác nhau.
      const sourceCounts = new Map<string, number>();
      for (const item of items) {
        if (!item.sourceDocumentId) continue;
        sourceCounts.set(item.sourceDocumentId, (sourceCounts.get(item.sourceDocumentId) ?? 0) + 1);
      }
      let dominantSource: string | null = null;
      let dominantCount = 0;
      for (const [docId, count] of sourceCounts) {
        if (count > dominantCount) {
          dominantSource = docId;
          dominantCount = count;
        }
      }
      const sourceDocumentId = dominantCount > items.length / 2 ? dominantSource : null;

      return {
        subject,
        topic,
        mistakeCount: items.length,
        lastMistakeAt: latest.createdAt.toISOString(),
        exampleQuestion: latest.questionText,
        exampleExplanation: latest.explanation,
        sourceDocumentId,
      } satisfies WeakConcept;
    })
    .sort((a, b) => b.mistakeCount - a.mistakeCount || (a.lastMistakeAt < b.lastMistakeAt ? 1 : -1))
    .slice(0, limit);
}
