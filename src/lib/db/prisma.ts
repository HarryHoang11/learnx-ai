// ================================================================
// PRISMA CLIENT — SINGLETON
// ================================================================
// Mạch tư duy: ở môi trường dev, Next.js hot-reload file liên tục.
// Nếu mỗi lần reload lại `new PrismaClient()`, sau vài chục lần save
// code sẽ có hàng chục connection Postgres bị mở treo (Next.js chỉ
// reload module route, không restart tiến trình Node).
// Giải pháp chuẩn của Prisma: cache instance vào biến global, chỉ
// tạo mới nếu chưa tồn tại.
// ================================================================

import { PrismaClient } from "@prisma/client";

// Khai báo thêm field prisma vào globalThis để TypeScript không báo lỗi
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // log query lúc dev để dễ debug adaptive logic (xem query nào chạy
    // khi tính mastery), tắt ở production để đỡ rác log.
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
