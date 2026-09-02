// ================================================================
// <SessionProviderWrapper /> — bọc next-auth SessionProvider
// ================================================================
// Mạch tư duy: hook useSession()/signIn()/signOut() phía client CHỈ
// hoạt động khi cây component nằm trong <SessionProvider>. Root
// layout (layout.tsx) là Server Component nên KHÔNG thể tự dùng
// "use client" cho cả file — tách riêng 1 component client nhỏ để
// bọc children, giữ layout.tsx gọn và vẫn là Server Component.
// ================================================================

"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export default function SessionProviderWrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
