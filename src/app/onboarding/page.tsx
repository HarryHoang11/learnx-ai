// ================================================================
// /onboarding — Hồ sơ học tập (Learning Profile)
// ================================================================
// Mạch tư duy: route này nằm NGOÀI nhóm (app) vì onboarding là trải nghiệm
// toàn màn hình, không có sidebar/topbar — cùng cách /welcome và /setup được
// tách riêng. Nhờ vậy người dùng tập trung trả lời, không bị phân tâm.
//
// KHÔNG chặn người dùng: ai cũng mở được (để sửa lại hồ sơ từ Dashboard hoặc
// Account). Việc "user mới có bị ép làm không" do proxy + Welcome quyết định,
// không do trang này — xem docs/WELCOME.md.
"use client";

import LearningOnboarding from "./LearningOnboarding";

export default function OnboardingPage() {
  return <LearningOnboarding />;
}
