// ================================================================
// PRISMA CLIENT — SINGLETON + SERVERLESS POOLING
// ================================================================
// 1) SINGLETON: ở môi trường dev, Next.js hot-reload file liên tục. Nếu
//    mỗi lần reload lại `new PrismaClient()`, sau vài chục lần save code
//    sẽ có hàng chục connection Postgres bị mở treo (Next.js chỉ reload
//    module route, không restart tiến trình Node). Giải pháp chuẩn của
//    Prisma: cache instance vào biến global, chỉ tạo mới nếu chưa có.
//
// 2) SERVERLESS (Vercel): mỗi lambda instance là 1 tiến trình Node riêng
//    và bị scale ngang rất nhanh, nên "1 connection/user" của Postgres
//    (mặc định Prisma là 10 connection mỗi client!) sẽ nhanh chóng làm
//    cạn `max_connections` của Postgres -> lỗi P1001/"too many clients"
//    -> API trả HTTP 500 ngẫu nhiên (lúc được lúc không, đúng kiểu lỗi
//    khó tái hiện ở local). Vì vậy: trên serverless, tự ép
//    `connection_limit=1` (mỗi instance chỉ giữ 1 connection, dùng
//    xong trả về pool) nếu DATABASE_URL chưa khai báo tường minh.
// ================================================================

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Vercel/AWS Lambda đều chạy code trong tiến trình "dùng 1 lần rồi có
 * thể bị đóng" — không phải server truyền thống giữ connection lâu dài.
 */
function isServerlessRuntime(): boolean {
  return !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}

/**
 * Trả về connection string đã thêm tham số pooling cho serverless.
 *
 * Ghi chú quan trọng: đây KHÔNG phải nơi "đoán" cấu hình DB của bạn —
 * chỉ thêm 2 tham số mà Prisma + Postgres chấp nhận ở MỌI nhà cung cấp
 * (`connection_limit`, `pool_timeout`), và chỉ khi người dùng CHƯA tự
 * khai báo. Nếu bạn đã set sẵn trong DATABASE_URL (vd dùng PgBouncer
 * của Supabase với `?pgbouncer=true&connection_limit=1`) thì hàm này
 * trả nguyên chuỗi gốc, không ghi đè.
 *
 * Cấu hình khuyến nghị khi deploy Vercel (đặt trong Environment
 * Variables, KHÔNG commit vào repo):
 *   DATABASE_URL = connection string qua POOLER (Supabase: cổng 6543,
 *                  thêm `?pgbouncer=true&connection_limit=1`)
 *
 * Lưu ý về migration: PgBouncer transaction-mode KHÔNG chạy được
 * `prisma migrate deploy`. Cách xử lý: chạy migration bằng connection
 * string TRỰC TIẾP (Supabase: cổng 5432) ngay trên máy dev/CI, ví dụ
 *   DATABASE_URL="<direct-5432-url>" npx prisma migrate deploy
 * (schema.prisma hiện KHÔNG khai báo `directUrl` — thêm biến đó chỉ có
 * tác dụng nếu đồng thời sửa datasource, nên tài liệu ở đây mô tả đúng
 * những gì code thực sự hỗ trợ.)
 */
function withServerlessPooling(url: string): string {
  if (!isServerlessRuntime()) return url;
  if (!url || /connection_limit=/.test(url)) return url;

  try {
    const parsed = new URL(url);
    parsed.searchParams.set("connection_limit", "1");
    parsed.searchParams.set("pool_timeout", "20");

    // Supabase (và các PgBouncer transaction-mode pooler khác) BẮT BUỘC
    // có `pgbouncer=true` để Prisma tắt prepared statements — thiếu tham
    // số này, query sẽ lỗi "prepared statement already exists" khi nhiều
    // instance dùng chung pooler. Nhận biết qua cổng 6543 (cổng pooler
    // chuẩn của Supabase) thay vì hard-code host của một nhà cung cấp.
    if (parsed.port === "6543" && !parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }

    return parsed.toString();
  } catch {
    // URL không parse được (hiếm) — giữ nguyên, để Prisma báo lỗi rõ
    // ràng thay vì nuốt lỗi cấu hình ở đây.
    return url;
  }
}

const datasourceUrl = withServerlessPooling(process.env.DATABASE_URL ?? "");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Chỉ truyền datasourceUrl khi thật sự có giá trị — nếu DATABASE_URL
    // trống, để Prisma tự ném lỗi chuẩn (báo thiếu biến môi trường) thay
    // vì nhận chuỗi rỗng khó hiểu.
    ...(datasourceUrl ? { datasourceUrl } : {}),
    // log query lúc dev để dễ debug adaptive logic (xem query nào chạy
    // khi tính mastery), tắt ở production để đỡ rác log.
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
