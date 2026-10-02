// ================================================================
// CLIENT HELPER — đọc ApiResponse mà không để lỗi JSON che mất nguyên nhân
// ----------------------------------------------------------------
// Vấn đề giải quyết (rất hay gặp trên mạng di động / trong WebView của app):
// `res.json()` ném SyntaxError khi body KHÔNG phải JSON — vd proxy/CDN trả
// HTML 502, hoặc body rỗng khi request bị chặn giữa đường. Catch block kiểu
// thường rồi hiển thị nguyên message lỗi đó cho người dùng, tức là màn hình
// hiện "Unexpected token '<'" hoặc "Failed to fetch" — đúng những thứ không
// được phép lộ ra UI.
//
// Cách sửa: đọc body dạng TEXT trước, parse thủ công. Parse fail thì log đầy
// đủ status + body (cho dev) nhưng ném `TransportError` với thông điệp rõ
// ràng, để tầng trên quyết định hiển thị gì — thường là key i18n
// `common.connectionError`.
//
// Nguồn gốc: hàm này trước đây nằm riêng trong
// src/app/(app)/diagnostic/page.tsx và chỉ dùng ở đó. Tách ra đây để các
// trang khác (workspace, library, tutor...) dùng chung ĐÚNG MỘT cách xử lý,
// thay vì mỗi trang tự viết lại `res.json()` rồi mắc cùng một lỗi.
// ================================================================

import type { ApiResponse } from "@/types";

/**
 * Lỗi KHÔNG phải do server trả về (response không phải JSON — vd proxy trả
 * HTML 500, mất mạng, request bị abort). Tách riêng để caller KHÔNG show
 * message kỹ thuật cho người dùng, nhưng vẫn log đầy đủ cho dev.
 */
export class TransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransportError";
  }
}

/**
 * Lỗi chủ động do app code ném với message đã viết cho người dùng.
 *
 * Tách riêng khỏi `Error` thường để `describeError` phân biệt được: message
 * của class này ĐÃ được con người viết để hiện ra UI (vd lấy từ `json.error`
 * của API — trường hợp rất phổ biến với /api/rewards/redeem, nơi server trả
 * về "Không đủ LXP để đổi phần thưởng này."), nên giữ nguyên. Ngược lại,
 * `err instanceof Error` nào cũng giữ message sẽ lọt "Unexpected token '<'"
 * ra ngoài.
 */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Đọc ApiResponse từ một Response; ném TransportError nếu body không phải JSON.
 *
 * @param res   Response của fetch.
 * @param label Nhãn gọi (vd "POST /api/ai/chat") — chỉ dùng cho log dev và
 *              message của TransportError, KHÔNG dùng để hiển thị.
 */
export async function readApi<T>(res: Response, label: string): Promise<ApiResponse<T>> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as ApiResponse<T>;
  } catch {
    console.error(
      `[api] ${label} trả về ${res.status} nhưng body không phải JSON:`,
      raw.slice(0, 300)
    );
    throw new TransportError(`${label} -> HTTP ${res.status} (body không phải JSON)`);
  }
}

/**
 * Diễn giải lỗi bắt được thành thông điệp ĐƯỢC HIỂN THỊ cho người dùng.
 *
 * Vì sao cần: pattern `catch (err) { setError(err.message) }` xuất hiện ở
 * khắp các trang và là nơi lộ message kỹ thuật ra UI — "Unexpected token '<'"
 * (HTML từ proxy), "Failed to fetch" (mạng), "NetworkError when attempting to
 * fetch resource" (WebView), "Load failed" (iOS). Người dùng không hiểu và
 * không biết phải làm gì.
 *
 * Quy tắc:
 *   - `TransportError` do readApi ném => thay bằng `fallback` (thường là key
 *     i18n `common.connectionError`) vì nguyên nhân là response hỏng/mạng.
 *   - Lỗi mạng từ `fetch` (TypeError: "Failed to fetch" / "Load failed") =>
 *     cũng về `fallback`.
 *   - `ApiError` và `Error` thường (message do app viết sẵn) => giữ nguyên.
 *   - Còn lại => `fallback` cho an toàn, KHÔNG bao giờ lộ message lạ.
 *
 * @param fallback Thông điệp dự phòng ĐÃ QUA i18n (dùng `t()`).
 */
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof TransportError) return fallback;
  if (err instanceof TypeError) return fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
