// ================================================================
// TRANG GỐC "/"
// ================================================================
// Mạch tư duy: MVP demo không cần trang landing marketing riêng —
// điều hướng thẳng vào /dashboard để ban giám khảo/người dùng vào là
// thấy sản phẩm ngay, đỡ mất thời gian click thêm 1 bước.
// ================================================================

import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}
