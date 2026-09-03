// ================================================================
// <ProfileHeader /> — ảnh bìa + avatar đè lên góc, mỗi ảnh có nút
// camera riêng để đổi ảnh, xem trước (preview) NGAY LẬP TỨC bằng
// URL.createObjectURL trước khi chờ server trả về kết quả upload.
// ================================================================
// Mạch tư duy quan trọng nhất của component này — 2 tầng ảnh khác
// nhau cùng lúc:
//   1) "preview" (local, tạm thời): tạo ngay khi user chọn file, dùng
//      URL.createObjectURL(file) — không cần chờ mạng, UI phản hồi
//      TỨC THÌ (đúng yêu cầu "xem trước ngay lập tức").
//   2) "ảnh thật đã lưu" (profile.image / profile.coverImage): chỉ có
//      SAU khi server upload xong. Nếu upload lỗi, ta phải revert lại
//      preview về ảnh cũ — đây là lý do cần 2 state riêng
//      (previewAvatar/previewCover) thay vì ghi đè thẳng vào
//      profile.image ngay khi chọn file.
// Nhớ revoke ObjectURL (URL.revokeObjectURL) khi thay ảnh mới / unmount
// để tránh rò rỉ bộ nhớ — trình duyệt giữ blob trong RAM cho tới khi
// revoke, dùng nhiều lần mà không revoke sẽ ngốn RAM dần theo thời gian.
// ================================================================

"use client";

import { useRef, useState, useEffect } from "react";
import type { UserProfile } from "@/types";

interface ProfileHeaderProps {
  profile: UserProfile;
  // Lift state lên component cha (trang /profile) để nếu sau này có
  // chỗ khác trong app cần hiển thị avatar mới (vd Topbar), chỉ cần
  // đọc lại từ 1 nguồn state duy nhất — ProfileHeader không tự giữ
  // "sự thật" (source of truth) về ảnh, chỉ giữ preview tạm thời.
  onPhotoUpdated: (patch: Partial<Pick<UserProfile, "image" | "coverImage">>) => void;
}

type PhotoKind = "avatar" | "cover";

export default function ProfileHeader({ profile, onPhotoUpdated }: ProfileHeaderProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [previewCover, setPreviewCover] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dọn ObjectURL cũ khi component unmount, tránh rò rỉ bộ nhớ (xem
  // giải thích ở đầu file).
  useEffect(() => {
    return () => {
      if (previewAvatar) URL.revokeObjectURL(previewAvatar);
      if (previewCover) URL.revokeObjectURL(previewCover);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cleanup lúc unmount
  }, []);

  async function handleFileChange(kind: PhotoKind, file: File | undefined) {
    if (!file) return;
    setError(null);

    const objectUrl = URL.createObjectURL(file);
    if (kind === "avatar") {
      if (previewAvatar) URL.revokeObjectURL(previewAvatar);
      setPreviewAvatar(objectUrl);
      setUploadingAvatar(true);
    } else {
      if (previewCover) URL.revokeObjectURL(previewCover);
      setPreviewCover(objectUrl);
      setUploadingCover(true);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", kind);

      const res = await fetch("/api/profile/photo", { method: "POST", body: formData });
      const json = await res.json();

      if (!json.success) {
        setError(json.error);
        // Upload lỗi -> revert preview về ảnh cũ (bỏ preview tạm), để
        // UI không "nói dối" rằng ảnh đã đổi thành công.
        if (kind === "avatar") setPreviewAvatar(null);
        else setPreviewCover(null);
        return;
      }

      onPhotoUpdated(kind === "avatar" ? { image: json.data.image } : { coverImage: json.data.coverImage });
    } catch {
      setError("Không thể kết nối tới máy chủ, thử lại sau.");
      if (kind === "avatar") setPreviewAvatar(null);
      else setPreviewCover(null);
    } finally {
      if (kind === "avatar") setUploadingAvatar(false);
      else setUploadingCover(false);
    }
  }

  const displayAvatar = previewAvatar ?? profile.image;
  const displayCover = previewCover ?? profile.coverImage;
  const initials = (profile.name ?? profile.email).slice(0, 2).toUpperCase();

  return (
    <div>
      <div
        className="profile-cover"
        style={displayCover ? { backgroundImage: `url(${displayCover})` } : undefined}
      >
        {uploadingCover && (
          <div className="photo-upload-overlay">
            <span className="spinner" />
          </div>
        )}

        <button
          type="button"
          className="photo-edit-btn photo-edit-btn--cover"
          onClick={() => coverInputRef.current?.click()}
          disabled={uploadingCover}
          aria-label="Đổi ảnh bìa"
          title="Đổi ảnh bìa"
        >
          📷
        </button>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => handleFileChange("cover", e.target.files?.[0])}
        />

        <div className="profile-avatar-wrap">
          <div className="profile-avatar">
            {displayAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- ảnh
              // local (blob:) hoặc path /uploads/... đều không phải domain
              // ngoài cần khai báo trong next.config.js images.domains.
              <img src={displayAvatar} alt={profile.name ?? "Avatar"} />
            ) : (
              <span className="profile-avatar-initials">{initials}</span>
            )}

            {uploadingAvatar && (
              <div className="photo-upload-overlay photo-upload-overlay--round">
                <span className="spinner" />
              </div>
            )}

            <button
              type="button"
              className="photo-edit-btn photo-edit-btn--avatar"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Đổi ảnh đại diện"
              title="Đổi ảnh đại diện"
            >
              📷
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => handleFileChange("avatar", e.target.files?.[0])}
            />
          </div>
        </div>
      </div>

      {error && <p style={{ color: "var(--rose)", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}