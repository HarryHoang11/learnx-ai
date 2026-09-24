/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js Dev Indicator (logo "N" tự nổi góc dưới-trái khi `next dev`) —
  // tắt hẳn để môi trường dev cũng sạch; Next.js tự loại bỏ nó khi build
  // production nên không ảnh hưởng Vercel.
  devIndicators: false,

  // Các package CHỈ chạy được ở server (đọc file bằng `fs`, dùng worker,
  // native addon...). Nếu để Next.js bundle chúng vào server chunk, đường
  // dẫn file nội bộ của package (pdfkit cần .afm/.ttf, pdf-parse cần file
  // test, pdfjs-dist cần worker) sẽ SAI sau khi build -> route 500 trên
  // Vercel dù chạy tốt ở local. Khai báo ở đây để Next giữ chúng là
  // external require, đọc thẳng từ node_modules trong runtime.
  serverExternalPackages: ["pdfkit", "pdf-parse", "pdfjs-dist", "mammoth", "jszip", "docx"],

  // Font Noto Sans (hỗ trợ tiếng Việt + ký hiệu toán) được đọc bằng
  // `fs.readFileSync` với đường dẫn ghép runtime -> bộ trace file của
  // Next.js KHÔNG tự phát hiện. Thiếu khai báo này, PDF trên Vercel sẽ
  // rơi vào fallback Helvetica (mất dấu tiếng Việt) thay vì render đúng
  // font đã commit trong repo.
  outputFileTracingIncludes: {
    "/api/**": ["./src/fonts/**"],
  },
};

// ----------------------------------------------------------------
// BUILD-TIME ENV CHECK
// ----------------------------------------------------------------
// Chạy khi Next nạp config (build/start), bao gồm cả build trên Vercel.
// Chỉ CẢNH BÁO tên biến còn thiếu — KHÔNG throw (không làm sập build) và
// KHÔNG in giá trị (không lộ secret ra log). Lý do tồn tại: thiếu
// AUTH_SECRET ở production khiến MỌI endpoint /api/auth/* trả 500
// (Auth.js ném MissingSecret) trong khi phần còn lại của app vẫn chạy —
// triệu chứng rất dễ bị chẩn đoán nhầm thành "server sập".
const REQUIRED_PRODUCTION_ENV = [
  "DATABASE_URL", // Prisma -> Postgres/pgvector (đồng thời là nguồn dẫn xuất secret dự phòng cho Auth.js)
];
const RECOMMENDED_PRODUCTION_ENV = [
  "AUTH_SECRET", // ký session JWT — nên set riêng; thiếu thì src/auth.ts tự dẫn xuất từ DATABASE_URL
];
const OPTIONAL_ENV = [
  "GEMINI_API_KEY", // provider AI chính
  "GROQ_API_KEY", // fallback 1
  "OPENROUTER_API_KEY", // fallback cuối
  "GOOGLE_CLIENT_ID", // chỉ cần nếu dùng đăng nhập Google
  "GOOGLE_CLIENT_SECRET",
];

function reportMissingEnv() {
  const missingRequired = REQUIRED_PRODUCTION_ENV.filter((name) => !process.env[name]);
  const missingRecommended = RECOMMENDED_PRODUCTION_ENV.filter((name) => !process.env[name]);
  const missingOptional = OPTIONAL_ENV.filter((name) => !process.env[name]);

  if (missingRequired.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `\n[env] THIẾU BIẾN BẮT BUỘC: ${missingRequired.join(", ")}\n` +
        `[env] Hậu quả: mọi API đọc/ghi DB (và cả /api/auth/* vì Auth.js không có secret dự phòng) sẽ trả HTTP 500.\n` +
        `[env] Cách sửa: thêm các biến trên vào Vercel > Project > Settings > Environment Variables (Production) rồi Redeploy.\n`
    );
  }
  if (missingRecommended.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `\n[env] KHUYẾN NGHỊ SET: ${missingRecommended.join(", ")}\n` +
        `[env] Không set cũng KHÔNG hỏng: src/auth.ts sẽ dẫn xuất secret ký session từ DATABASE_URL\n` +
        `[env] (kèm cảnh báo trong Runtime Logs). Set AUTH_SECRET=<chuỗi ngẫu nhiên> để tách khoá ký session khỏi credential DB.\n`
    );
  }
  if (missingOptional.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[env] Biến tuỳ chọn chưa set: ${missingOptional.join(", ")} — tính năng tương ứng sẽ bị tắt/bỏ qua, app vẫn chạy.`
    );
  }
}

reportMissingEnv();

module.exports = nextConfig;
