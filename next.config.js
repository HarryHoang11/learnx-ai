/** @type {import('next').NextConfig} */
const nextConfig = {
  // experimental.serverActions không cần bật thủ công ở Next 14 vì đã stable.
  // Để trống config vì MVP không cần custom webpack/rewrite gì đặc biệt —
  // tránh thêm cấu hình không dùng tới, giữ file dễ đọc cho người mới join dự án.
};

module.exports = nextConfig;
