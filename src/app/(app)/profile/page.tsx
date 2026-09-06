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
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import ProfileHeader from "@/components/profile/ProfileHeader";
import EditProfileModal from "@/components/profile/EditProfileModal";
import type { ApiResponse, UserProfile } from "@/types";

export default function ProfilePage() {
  // update(): hàm của next-auth để yêu cầu refresh lại session hiện
  // tại (kích hoạt lại callback `jwt` với trigger "update", xem
  // src/auth.ts) — đây là mắt xích còn thiếu trước đây khiến avatar ở
  // Topbar/FloatingAIButton không đổi theo khi đổi avatar ở trang này.
  const { update: updateSession } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((json: ApiResponse<UserProfile>) => {
        if (json.success) setProfile(json.data);
        else setError(json.error);
      })
      .catch(() => setError("Không thể kết nối tới máy chủ."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <StateMessage kind="loading" text="Đang tải hồ sơ..." />;
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
              {profile.name ?? "Chưa đặt tên"}
              {profile.nickname && (
                <span style={{ color: "var(--text-dim)", fontWeight: 500, fontSize: 16 }}> ({profile.nickname})</span>
              )}
            </h2>
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>{profile.email}</p>
          </div>

          <button type="button" className="btn-secondary" onClick={() => setIsEditing(true)}>
            Chỉnh sửa trang cá nhân
          </button>
        </div>

        <p style={{ marginTop: 16, fontSize: 14.5, lineHeight: 1.6, color: profile.bio ? "var(--text)" : "var(--text-faint)" }}>
          {profile.bio || "Chưa có tiểu sử — bấm \"Chỉnh sửa trang cá nhân\" để thêm vài dòng giới thiệu về bạn."}
        </p>
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
