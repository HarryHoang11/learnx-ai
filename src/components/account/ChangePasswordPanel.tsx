// ================================================================
// <ChangePasswordPanel /> — Đổi mật khẩu (chỉ cho tài khoản credentials)
// ================================================================
// Mạch tư duy: 3 ô input (mật khẩu hiện tại / mật khẩu mới / xác nhận) đúng
// theo yêu cầu bảo mật: server xác minh mật khẩu HIỆN TẠI bằng bcrypt trước
// khi ghi mật khẩu mới, nên client không được tự quyết định "đổi thành công".
//
// VÌ SAO form này tự chứa state password thay vì dùng chung state cha:
//   - 3 giá trị này là bí mật, tuyệt đối không được đưa vào props/state
//     cha để tránh rò rỉ qua DevTools React tree hay log.
//   - Giá trị được xoá khỏi state ngay khi submit thành công, và cả khi
//     đóng panel.
//
// AN TOÀN: KHÔNG lưu bất kỳ mật khẩu nào vào localStorage/sessionStorage.
// Chỉ giữ trong RAM của React state và gửi lên server qua POST, nơi được
// hash bằng bcrypt trước khi lưu.
// ================================================================

"use client";

import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import Panel from "@/components/ui/Panel";
import PasswordInput from "@/components/auth/PasswordInput";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useToast } from "@/components/ui/Toast";
import type { ApiResponse } from "@/types";

const MIN_PASSWORD_LENGTH = 8;

interface ChangePasswordPanelProps {
  hasPassword: boolean;
}

export default function ChangePasswordPanel({ hasPassword }: ChangePasswordPanelProps) {
  const { t } = useLanguage();
  const { push } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tài khoản Google/SSO không có passwordHash nên không có "mật khẩu hiện
  // tại" để xác minh. Hiển thị trạng thái thay vì form để không dễ nhầm rằng
  // form bị lỗi.
  if (!hasPassword) {
    return (
      <Panel className="profile-security-panel">
        <div className="profile-security-header">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>{t("account.security")}</span>
        </div>
        <p className="profile-security-note">{t("account.googleNoPassword")}</p>
      </Panel>
    );
  }

  function clearFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError(null);

    // Kiểm tra tối thiểu phía client để phản hồi tức thì, nhưng KHÔNG phải
    // nguồn kiểm chứng thật — server vẫn kiểm tra lại mọi quy tắc.
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t("account.passwordTooShort", { n: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("account.passwordMismatch"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const json: ApiResponse<null> = await res.json();
      if (!json.success) {
        setError(json.error);
        return;
      }
      // Xoá ngay các giá trị bí mật khỏi state sau khi đổi xong.
      clearFields();
      push("success", t("account.passwordChanged"));
    } catch {
      setError(t("common.connectionError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel className="profile-security-panel">
      <div className="profile-security-header">
        <KeyRound size={17} aria-hidden="true" />
        <span>{t("account.changePassword")}</span>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
        <div>
          <label className="form-label" htmlFor="current-password">
            {t("account.currentPassword")}
          </label>
          <PasswordInput
            id="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            disabled={saving}
            autoComplete="current-password"
            placeholder={t("account.currentPassword")}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="new-password">
            {t("account.newPassword")}
          </label>
          <PasswordInput
            id="new-password"
            value={newPassword}
            onChange={setNewPassword}
            disabled={saving}
            autoComplete="new-password"
            placeholder={t("account.passwordTooShort", { n: MIN_PASSWORD_LENGTH })}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="confirm-password">
            {t("account.confirmNewPassword")}
          </label>
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={saving}
            autoComplete="new-password"
            placeholder={t("account.confirmNewPassword")}
          />
        </div>

        {error && <p style={{ color: "var(--rose)", fontSize: 13 }}>{error}</p>}

        <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: "flex-start" }}>
          {saving ? (
            <>
              <Loader2 size={15} className="spinner" aria-hidden="true" />
              <span>{t("account.saving")}</span>
            </>
          ) : (
            <span>{t("account.updatePassword")}</span>
          )}
        </button>
      </form>
    </Panel>
  );
}