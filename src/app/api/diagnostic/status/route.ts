// ================================================================
// GET /api/diagnostic/status — tình trạng diagnostic theo môn
// ================================================================
//
// Trả về 2 thứ:
//   1) `history` — môn nào đã làm / chưa làm, mastery gần nhất (như cũ).
//   2) `suggestedSubjects` — môn NÊN đánh giá trước, xếp hạng từ
//      hồ sơ học tập (môn user chọn + môn đang yếu theo dữ liệu
//      thật).
//
// VÌ SAO THÊM: yêu cầu §19 — Diagnostic phải bám grade/track/subjects/goal
// chứ không phải lúc nào cũng mặc định Toán. Hàm xếp hạng chỉ
// SẮP XẾP danh sách môn hợp lệ mà hồ sơ đã nêu, KHÔNG tự
// chế môn mới; danh sách rỗng thì UI hiển thị đầy đủ như cũ —
// tức là thay đổi này KHÔNG BAO GIỜ chặn user.
//
// DATA ISOLATION: userId lấy từ getCurrentUserId() (session Auth.js), không
// bao giờ đọc từ query string của client.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getAssessmentHistoryBySubject } from "@/services/assessment.service";
import {
  getSuggestedDiagnosticSubjects,
  resolveDiagnosticLevel,
} from "@/services/personalization.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const history = await getAssessmentHistoryBySubject(userId);

    // Best-effort: hồ sơ lỗi thì vẫn trả history như cũ.
    let suggestedSubjects: string[] = [];
    try {
      suggestedSubjects = await getSuggestedDiagnosticSubjects(userId);
    } catch (err) {
      console.warn("[api/diagnostic/status] Không dựng được gợi ý môn:", err);
    }

    // Cấp/lớp để UI dựng bộ chọn lớp — lấy từ DB (nguồn sự thật), không
    // hardcode "10/11/12" ở frontend. `availableGrades` rỗng = hồ sơ chưa khai
    // cấp, UI bỏ qua bộ chọn và dùng mặc định của server.
    let level = {
      educationStage: null as string | null,
      grade: null as string | null,
      availableGrades: [] as string[],
    };
    try {
      const resolved = await resolveDiagnosticLevel(userId);
      level = {
        educationStage: resolved.educationStage,
        grade: resolved.grade,
        availableGrades: resolved.availableGrades,
      };
    } catch (err) {
      console.warn("[api/diagnostic/status] Không đọc được cấp/lớp:", err);
    }

    return NextResponse.json<
      ApiResponse<{
        history: typeof history;
        suggestedSubjects: string[];
        educationStage: string | null;
        grade: string | null;
        availableGrades: string[];
      }>
    >({
      success: true,
      data: {
        history,
        suggestedSubjects,
        educationStage: level.educationStage,
        grade: level.grade,
        availableGrades: level.availableGrades,
      },
    });
  } catch (err) {
    console.error("[api/diagnostic/status] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy trạng thái kiểm tra, thử lại sau." },
      { status: 500 }
    );
  }
}
