// ================================================================
// <FloatingAIButton /> — nút AI Gia sư nổi góc màn hình
// ================================================================
// Mạch tư duy:
//   - Avatar hiển thị lấy THẲNG từ session.user.image (useSession) —
//     CÙNG một nguồn dữ liệu với Topbar và trang Profile, KHÔNG lưu
//     riêng 1 bản avatar nào cho nút này. Khi user đổi avatar ở trang
//     Profile và gọi `update()` của next-auth (xem profile/page.tsx),
//     session ở ĐÂY tự re-render theo vì cùng đọc từ useSession() —
//     không cần prop-drilling, không cần state management mới.
//   - Chưa có avatar (session.user.image null, vd tài khoản đăng ký
//     bằng email/password chưa từng upload ảnh) -> fallback icon AI
//     mặc định, KHÔNG để ảnh vỡ (broken image).
//   - Ẩn khi đang loading session lần đầu (status === "loading") để
//     tránh nháy icon fallback rồi đổi ngay sang avatar thật.
// ================================================================

"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Sparkles } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { resolveAvatarUrl } from "@/lib/auth/avatarUrl";
import { useLanguage } from "@/components/providers/LanguageProvider";

/**
 * Kích thước nút. Phải khớp `--fab-size` trong globals.css — giá trị đó quyết
 * định vị trí của các bubble khác trong cột `.floating-actions`, nên lệch ở đây
 * sẽ làm cả cục lệch.
 */
const SIZE = 56;

export default function FloatingAIButton() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();

  if (status === "loading") return null;

  const name = session?.user?.name ?? session?.user?.email ?? t("nav.tutor");
  // Cùng nguồn chuẩn hoá với AccountMenu/Topbar — xem `resolveAvatarUrl`.
  const image = resolveAvatarUrl(session?.user?.image);

  return (
    <Link
      href="/tutor"
      aria-label={t("tutor.openChat")}
      title={t("nav.tutor")}
      style={{
        // CHỈ còn hình dạng. Toạ độ (position/right/bottom/z-index) KHÔNG nằm ở
        // đây nữa: `.floating-actions` (components/layout/FloatingActions.tsx)
        // là nguồn sự thật DUY NHẤT cho vị trí của mọi nút nổi, và cột flex
        // của nó tự dồn các nút theo thứ tự ưu tiên — nên nút này không thể bị
        // App Download bubble đè, kể cả khi kích thước thay đổi.
        //
        // Giữ `width/height` ở đây vì `Avatar` cần pixel để vẽ; giá trị khớp
        // `--fab-size` trong globals.css (56px). Nếu đổi, sửa CẢ HAI.
        width: SIZE,
        height: SIZE,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--panel-strong)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        overflow: "hidden",
      }}
      className="floating-ai-button"
    >
      {/* `resolveAvatarUrl` LUÔN trả về URL (xem lib/auth/avatarUrl.ts) —
          nhánh else bên dưới là dead code từ trước đó, giữ lại chỉ để chắc
          chắn nếu hàm đó đổi hành vi. Icon rơi về Lucide `Sparkles` — đồng bộ
          phần còn lại của UI (AppDownloadBubble dùng Lucide `Smartphone`/
          `Download`), thay vì glyph `✺` trông lạc lõng giữa các icon khác. */}
      {image ? (
        <Avatar src={image} name={name} size={SIZE} ringColor="var(--cyan)" />
      ) : (
        <Sparkles size={24} aria-hidden="true" style={{ color: "var(--cyan)" }} />
      )}
    </Link>
  );
}
