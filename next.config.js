/** @type {import('next').NextConfig} */
const nextConfig = {
  // experimental.serverActions không cần bật thủ công ở Next 14 vì đã stable.
  // Để trống config vì MVP không cần custom webpack/rewrite gì đặc biệt —
  // tránh thêm cấu hình không dùng tới, giữ file dễ đọc cho người mới join dự án.

  // Tắt Next.js Dev Indicator (logo "N" Next.js tự nổi góc dưới-trái khi
  // chạy `next dev`) — đây chính là nguồn gốc chữ "N"/error-like badge
  // xuất hiện trên UI mà audit PHASE 6 yêu cầu tìm. KHÔNG phải bug của
  // LearnX, cũng KHÔNG xuất hiện ở production build (`next start`) —
  // Next.js tự loại bỏ nó khi build production. Tắt hẳn ở đây để môi
  // trường dev cũng sạch, tránh nhầm lẫn nó là lỗi thật lần nữa.
  devIndicators: false,
};

module.exports = nextConfig;
