// ================================================================
// <EditProfileModal /> — modal chỉnh sửa Họ tên / Biệt danh / Tiểu sử
// ================================================================
// Mạch tư duy: giữ state form RIÊNG với `profile` của component cha
// (không sửa thẳng lên state cha khi gõ phím) — chỉ commit lên cha
// (qua onSaved) SAU KHI server xác nhận lưu thành công. Nhờ vậy nút
// "Hủy" chỉ cần đóng modal, KHÔNG cần logic "revert" phức tạp vì
// state cha chưa từng bị đổi trong lúc gõ.
// ================================================================

"use client";

import { useState } from "react";
import type { UserProfile } from "@/types";

const BIO_MAX_LENGTH = 150;

interface EditProfileModalProps {
  profile: UserProfile;
  onClose: () => void;
  onSaved: (updated: UserProfile) => void;
}

export default function EditProfileModal({ profile, onClose, onSaved }: EditProfileModalProps) {
  const [name, setName] = useState(profile.name ?? "");
  const [nickname, setNickname] = useState(profile.nickname ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);

    if (name.trim().length === 0) {
      setError("Họ và tên không được để trống.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), nickname: nickname.trim(), bio: bio.trim() }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error);
        return;
      }

      onSaved(json.data);
    } catch {
      setError("Không thể kết nối tới máy chủ, thử lại sau.");
    } finally {
      setSaving(false);
    }
  }

  return (
    // Click nền mờ để đóng (giống UX modal chuẩn), nhưng click bên
    // trong modal-card thì KHÔNG đóng — chặn bằng stopPropagation ở
    // thẻ con để tránh đóng nhầm khi user chỉ đang bấm vào input.
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, marginBottom: 18 }}>Chỉnh sửa trang cá nhân</h3>

        <label className="form-label" htmlFor="edit-name">
          Họ và tên
        </label>
        <input
          id="edit-name"
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          placeholder="Nguyễn Văn A"
        />

        <label className="form-label" htmlFor="edit-nickname">
          Biệt danh
        </label>
        <input
          id="edit-nickname"
          className="form-input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          disabled={saving}
          placeholder="Alex"
        />

        <label className="form-label" htmlFor="edit-email">
          Email
        </label>
        {/* Email hiển thị read-only — không cho sửa trực tiếp ở đây vì
            đổi email liên quan tới xác thực lại tài khoản (emailVerified),
            cần luồng riêng (xác nhận qua email mới) ngoài phạm vi MVP. */}
        <input id="edit-email" className="form-input" value={profile.email} disabled readOnly />

        <label className="form-label" htmlFor="edit-bio">
          Tiểu sử
          <span className="form-label-counter">
            {bio.length}/{BIO_MAX_LENGTH}
          </span>
        </label>
        <textarea
          id="edit-bio"
          className="form-textarea"
          value={bio}
          maxLength={BIO_MAX_LENGTH}
          onChange={(e) => setBio(e.target.value)}
          disabled={saving}
          placeholder="Vài dòng giới thiệu về bản thân..."
          rows={3}
        />

        {error && <p style={{ color: "var(--rose)", fontSize: 13, marginTop: 10 }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}