// ================================================================
// CLIENT HELPER — GET /api/review/due (khử trùng request đang bay)
// ================================================================
// Mạch tư duy: /api/review/due có ĐÚNG 2 nơi gọi — trang Review
// (limit=30) và dashboard (limit=5). Cả hai đều fetch trong useEffect
// khi mount, và không có cơ chế nào chống gọi trùng. Hệ quả đã quan
// sát được: cùng 1 URL bị bắn nhiều request giống hệt nhau vì:
//   1. React StrictMode (dev — bật mặc định với App Router của Next.js)
//      chạy effect 2 lần mỗi lần mount;
//   2. Fast Refresh chạy lại effect mỗi khi lưu file lúc đang dev;
//   3. component remount (điều hướng qua lại) trong lúc request trước
//      CHƯA xong sẽ mở thêm request mới.
// Mỗi request lặp như vậy lại chạy lại toàn bộ query Prisma trên
// ReviewItem (count due/overdue/upcoming + thống kê + lấy danh sách) —
// hoàn toàn lãng phí, vì kết quả của request đang bay CHÍNH LÀ kết quả
// mà request lặp cần.
//
// Cách sửa Ở ĐÚNG TẦNG PHÁT SINH: gom mọi lời gọi ĐANG BAY của cùng
// một URL về 1 promise duy nhất (in-flight dedupe). Lời gọi thứ 2 trở
// đi (StrictMode / remount nhanh / 2 component cùng lúc) nhận LẠI đúng
// promise đó — network chỉ có 1 request. Khi request kết thúc, entry
// được xoá NGAY, nên lần load kế tiếp (bấm "Làm mới", vào lại trang
// sau khi dữ liệu review đổi) vẫn là request mạng thật — KHÔNG cache
// dữ liệu cũ, chức năng refresh giữ nguyên.
// ================================================================

import type { ApiResponse } from "@/types";

/** 1 thẻ review đến hạn — đúng các field mà UI Review/Dashboard đọc. */
export interface DueReviewItem {
  id: string;
  topic: string;
  concept?: string | null;
  subject?: string | null;
  prompt: string;
  answer?: string | null;
  repetitions: number;
  nextReviewAt?: string | null;
}

export interface DueReviewsData {
  reviews: DueReviewItem[];
  stats: {
    due: number;
    overdue: number;
    upcoming: number;
    total: number;
    averageEaseFactor: number;
  };
  /** null = UI không yêu cầu insights (dashboard) hoặc đang lọc môn. */
  insights: ReviewInsights | null;
}

/**
 * Thống kê "nên ôn gì hôm nay" — chỉ có khi UI yêu cầu `?insights=true` và
 * KHÔNG lọc môn (route tự quyết định). Mọi con số đếm trên bảng ReviewItem
 * của chính user, không phải gợi ý bịa.
 */
export interface ReviewInsights {
  /** Số nội dung đến hạn theo từng môn — nguồn cho bước "chọn môn để ôn". */
  subjects: { subject: string; due: number }[];
  /** Chủ đề hay sai (nhiều lần quên/lạc) — SM-2 đã hạ lịch ôn của chúng. */
  weakTopics: { subject: string | null; topic: string; due: number; lapses: number }[];
}

export type DueReviewsResponse = ApiResponse<DueReviewsData>;

/**
 * Tuỳ chọn cho helper — `?subject=` để ôn riêng một môn.
 *
 * Lưu ý về `insights`: chỉ có khi `?insights=true` VÀ không lọc môn (route tự
 * quyết định). Dashboard gọi không truyền gì nên `insights` = null — không
 * tốn query thừa.
 */
export interface DueReviewsOptions {
  subject?: string;
  /** Yêu cầu thống kê "nên ôn gì hôm nay" (môn + chủ đề hay sai). */
  insights?: boolean;
}

// URL -> promise đang bay. Chỉ tồn tại trong khoảng request chưa xong.
// Khoá theo URL ĐẦY ĐỦ (gồm query) nên lọc môn khác sẽ không dùng nhầm
// promise của lần gọi không lọc.
const inFlight = new Map<string, Promise<DueReviewsResponse>>();

/**
 * GET /api/review/due — nguồn DUY NHẤT cho cả 3 consumer
 * (trang /review, /dashboard, learning-agent).
 *
 * Gọi trùng khi request trước CHƯA hoàn tất => nhận lại cùng 1 promise
 * (1 request mạng), không phát sinh query Prisma thừa.
 */
export function fetchDueReviews(
  limit: number,
  options: DueReviewsOptions = {},
): Promise<DueReviewsResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (options.subject) params.set("subject", options.subject);
  if (options.insights) params.set("insights", "true");

  const url = `/api/review/due?${params.toString()}`;
  const pending = inFlight.get(url);
  if (pending) return pending;

  const request = fetch(url)
    .then((res) => res.json() as Promise<DueReviewsResponse>)
    .finally(() => {
      inFlight.delete(url);
    });

  inFlight.set(url, request);
  return request;
}
