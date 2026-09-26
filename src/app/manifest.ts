// ================================================================
// PWA manifest — cho phép cài LearnX AI web như app
// ================================================================
//
// Icon trỏ về /brand/learnx-mark.svg — CÙNG asset với logo trong app, nên
// icon cài đặt không bao giờ lệch với logo hiển thị trong UI.
//
// `theme_color` / `background_color` lấy đúng design system:
// nền #070b16, indigo #7775ff. Không hard-code ở component khác.
// ================================================================

import type { MetadataRoute } from "next";
import { LEARNX_LOGO_SRC } from "@/components/brand/LearnXLogo";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LearnX AI",
    short_name: "LearnX",
    description: "Trợ lý học tập cá nhân hoá bằng AI",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#070b16",
    theme_color: "#7775ff",
    orientation: "portrait",
    lang: "vi",
    icons: [
      {
        src: LEARNX_LOGO_SRC,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
