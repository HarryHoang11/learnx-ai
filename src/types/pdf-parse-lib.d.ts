// ================================================================
// MODULE AUGMENTATION — pdf-parse (đường dẫn con /lib/pdf-parse.js)
// ================================================================
// Mạch tư duy: @types/pdf-parse chỉ khai báo type cho đường dẫn gốc
// "pdf-parse" (tức index.js của package). Nhưng index.js chứa đoạn
// code debug tự đọc file test nội bộ, gây lỗi ENOENT khi bị Next.js/
// webpack bundle (xem comment chi tiết trong extractText.ts) — nên
// code phải import thẳng "pdf-parse/lib/pdf-parse.js" để bypass. Vì
// đường dẫn con này không có sẵn type, TypeScript báo lỗi 7016.
//
// File này khai báo lại type cho đường dẫn con đó — tái sử dụng CHÍNH
// type function đã có sẵn từ "pdf-parse" (2 đường dẫn export ra cùng
// một hàm parse, chỉ khác ở chỗ index.js có thêm đoạn debug code bọc
// ngoài) nên không cần tự viết lại toàn bộ interface Data/Options.
// ================================================================

declare module "pdf-parse/lib/pdf-parse.js" {
  import pdfParse = require("pdf-parse");
  export default pdfParse;
}
