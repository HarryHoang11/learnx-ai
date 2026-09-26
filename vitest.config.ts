// ================================================================
// VITEST CONFIG
// ================================================================
//
// Vì sao file này tồn tại: alias `@/...` khai báo trong tsconfig.json là cấu
// hình của TypeScript/Next.js, Vitest (Vite) KHÔNG tự đọc. Trước khi có file
// này, các test cũ "chạy được" chỉ vì chúng import bằng ĐƯỜNG DẪN TƯƠNG ĐỐI
// cho mọi giá trị runtime (import `@/types` chỉ là import KIỂU — bị xoá lúc
// transform nên không bao giờ cần resolve). Bất kỳ test nào import giá trị
// runtime qua `@/...` đều fail với "Failed to load url @/...".
//
// Khai báo alias ở đây giữ đúng 1 nguồn sự thật: code và test dùng cùng cách
// viết import, nên test được viết tự nhiên như code thật thay vì phải né
// alias. Chỉ khai path `@` (không liệt kê `~`, `$`, hay plugin nào khác) —
// vitest.config.ts nằm ngoài src nên không cần config cho Next.js.
// ================================================================

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Test chỉ chạy trên mã nguồn TS/TSX của project.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
