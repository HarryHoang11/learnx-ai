// ================================================================
// TRANG CÁ NHÂN (Profile)
// ================================================================
// Mạch tư duy: cùng pattern fetch-on-mount như các trang khác trong
// app (progress, calendar...) — "use client" + useEffect fetch GET,
// giữ đồng nhất với phần còn lại thay vì tự sáng tạo cách khác.
// ================================================================

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import LevelProgressBar from "@/components/ui/LevelProgressBar";
import ProfileHeader from "@/components/profile/ProfileHeader";
import EditProfileModal from "@/components/profile/EditProfileModal";
import ChangePasswordPanel from "@/components/account/ChangePasswordPanel";
import LearningProfilePanel from "@/components/account/LearningProfilePanel";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ApiResponse, UserProfile } from "@/types";

interface StreakResponse {
  streak: { current: number; longest: number; lastLearningDay: string | null };
  progress: {
    lifetimeXP: number;
    lifetimeLXP: number;
    lxpBalance: number;
    level: number;
  } | null;
}

interface PasswordStatus {
  hasPassword: boolean;
}

export default function ProfilePage() {
  // update(): hàm của next-auth để yêu cầu refresh lại session hiện
  // tại (kích hoạt lại callback `jwt` với trigger "update", xem
  // src/auth.ts) — đây là mắt xích còn thiếu trước đây khiến avatar ở
  // Topbar/FloatingAIButton không đổi theo khi đổi avatar ở trang này.
  const { update: updateSession } = useSession();
  const { t } = useLanguage();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [lifetimeXP, setLifetimeXP] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  // null = chưa biết tài khoản này có mật khẩu hay không. Giữ null (thay vì
  // mặc định false) để không hiển thị nhầm "tài khoản Google" trong lúc
  // request trạng thái mật khẩu còn đang bay.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((json: ApiResponse<UserProfile>) => {
        if (json.success) setProfile(json.data);
        else setError(json.error);
      })
      .catch(() => setError(t("common.connectionError")))
      .finally(() => setLoading(false));

    // Tái dùng API streak sẵn có (không đổi contract) chỉ để lấy
    // lifetimeXP cho thanh Level — lỗi thì đơn giản không hiện thanh.
    fetch("/api/streak")
      .then((res) => res.json())
      .then((json: ApiResponse<StreakResponse>) => {
        if (json.success && typeof json.data.progress?.lifetimeXP === "number") {
          setLifetimeXP(json.data.progress.lifetimeXP);
        }
      })
      .catch(() => {});

    // Tài khoản này là credentials hay Google? Quyết định hiển thị form
    // đổi mật khẩu. Độc lập với request /api/profile nên chạy song song.
    fetch("/api/auth/password")
      .then((res) => res.json())
      .then((json: ApiResponse<PasswordStatus>) => {
        if (json.success) setHasPassword(json.data.hasPassword);
      })
      .catch(() => setHasPassword(false));
  }, []);

  if (loading) return <StateMessage kind="loading" text={t("profile.loading")} />;
  if (error) return <StateMessage kind="error" text={error} />;
  if (!profile) return null;

  return (
    <section className="profile-page">
      <ProfileHeader
        profile={profile}
        onPhotoUpdated={(patch) => {
          setProfile((p) => (p ? { ...p, ...patch } : p));

          // Chỉ avatar (image) mới cần đồng bộ session — coverImage
          // không nằm trong session.user nên không cần/không nên gửi
          // lên đây (giữ payload update() tối thiểu, đúng field).
          if (patch.image !== undefined) {
            // Không cần await/xử lý lỗi ở đây: nếu update() lỗi mạng,
            // profile page vẫn đã hiển thị avatar mới đúng (từ
            // setProfile ở trên) — Topbar/FloatingAIButton chỉ tạm thời
            // chưa kịp đồng bộ, sẽ tự đúng lại ở lần load session tiếp
            // theo, không phải lỗi nghiêm trọng cần chặn UI.
            updateSession({ user: { image: patch.image } });
          }
        }}
      />

      <Panel className="profile-info-panel">
        <div className="profile-info-header">
          <div>
            <h2 style={{ fontSize: 21, marginBottom: 2 }}>
              {profile.name ?? t("profile.noName")}
              {profile.nickname && (
                <span style={{ color: "var(--text-dim)", fontWeight: 500, fontSize: 16 }}> ({profile.nickname})</span>
              )}
            </h2>
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>{profile.email}</p>
          </div>

          <button type="button" className="btn-secondary" onClick={() => setIsEditing(true)}>
            {t("profile.edit")}
          </button>
        </div>

        <p style={{ marginTop: 16, fontSize: 14.5, lineHeight: 1.6, color: profile.bio ? "var(--text)" : "var(--text-faint)" }}>
          {profile.bio || t("profile.noBio")}
        </p>
      </Panel>

      {lifetimeXP !== null && <LevelProgressBar lifetimeXP={lifetimeXP} />}

      {/* Chỉ render panel bảo mật khi đã biết tài khoản có mật khẩu hay
          không (hasPassword !== null) — tránh hiện nhầm thông báo "tài khoản
          Google" trong lúc request trạng thái còn đang bay. */}
      {hasPassword !== null && <ChangePasswordPanel hasPassword={hasPassword} />}

      {/* Hồ sơ học tập — nừa tạp vào Account (§22). Đọc ngay
          dưối Security vì và nội dung của tài khoản, nên ngưỗi
          để người đánh địfu. */}
      <LearningProfilePanel />

      {/* Đường quay lại Welcome + mở lại Quick Setup (yêu cầu §9 và §17.11:
          setup phải LUÔN mở được, không phải chỉ lúc mới đăng ký). */}
      <Panel>
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 12 }}>
          {t("profile.aboutLearnX")}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn-secondary" onClick={() => router.push("/setup")}>
            {t("account.personalize")}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.push("/welcome?replay=true")}>
            {t("account.replayWelcome")}
          </button>
        </div>
      </Panel>

      {isEditing && (
        <EditProfileModal
          profile={profile}
          onClose={() => setIsEditing(false)}
          onSaved={(updated) => {
            setProfile(updated);
            setIsEditing(false);
          }}
        />
      )}
    </section>
  );
}
