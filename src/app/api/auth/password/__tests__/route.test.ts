// Unit test cho /api/auth/password — phần bảo mật nhất của account.
//
// Vì sao test ở tầng route chứ không chỉ test logic: điểm dễ bị bỏ sót nhất
// ở đây KHÔNG phải thuật toán bcrypt (bcryptjs tự test) mà là các điều kiện
// biên: không có session, tài khoản OAuth không có passwordHash, mật khẩu
// hiện tại sai. Test mock @/auth + @/lib/db/prisma nên không cần DB thật và
// không bao giờ ghi mật khẩu thật vào bất kỳ đâu.
import { describe, expect, it, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ success: false, error: "Bạn cần đăng nhập để thực hiện thao tác này." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}));

import { PATCH, GET } from "../route";

function requestWith(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof PATCH>[0];
}

const validBody = {
  currentPassword: "old-password-1",
  newPassword: "new-password-2",
  confirmPassword: "new-password-2",
};

describe("PATCH /api/auth/password", () => {
  beforeEach(() => {
    mockGetCurrentUserId.mockReset();
    mockUserFindUnique.mockReset();
    mockUserUpdate.mockReset();
    mockUserUpdate.mockResolvedValue({ id: "user-1" });
  });

  it("rejects the request when there is no server-side session", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const res = await PATCH(requestWith(validBody));

    expect(res.status).toBe(401);
    // Không được chạm vào DB khi chưa xác thực.
    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("never trusts a userId sent by the client", async () => {
    mockGetCurrentUserId.mockResolvedValue("server-user");
    mockUserFindUnique.mockResolvedValue({
      id: "server-user",
      passwordHash: await bcrypt.hash("old-password-1", 4),
    });

    // Client cố ép đổi mật khẩu của user khác — userId trong body bị bỏ qua
    // hoàn toàn, route chỉ dùng id lấy từ session.
    const res = await PATCH(requestWith({ ...validBody, userId: "victim-user" }));

    expect(res.status).toBe(200);
    expect(mockUserFindUnique.mock.calls[0][0].where.id).toBe("server-user");
    expect(mockUserUpdate.mock.calls[0][0].where.id).toBe("server-user");
  });

  it("refuses to set a password for a Google/SSO account that has none", async () => {
    mockGetCurrentUserId.mockResolvedValue("google-user");
    // passwordHash = null là đặc trưng của tài khoản chỉ đăng nhập Google.
    mockUserFindUnique.mockResolvedValue({ id: "google-user", passwordHash: null });

    const res = await PATCH(requestWith(validBody));

    expect(res.status).toBe(409);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("rejects a wrong current password without writing anything", async () => {
    mockGetCurrentUserId.mockResolvedValue("user-1");
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: await bcrypt.hash("the-real-password", 4),
    });

    const res = await PATCH(requestWith({ ...validBody, currentPassword: "wrong-one" }));

    expect(res.status).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("rejects a too-short new password and a mismatched confirmation", async () => {
    mockGetCurrentUserId.mockResolvedValue("user-1");
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: await bcrypt.hash("old-password-1", 4),
    });

    const tooShort = await PATCH(requestWith({ ...validBody, newPassword: "short", confirmPassword: "short" }));
    expect(tooShort.status).toBe(400);

    const mismatch = await PATCH(requestWith({ ...validBody, confirmPassword: "different-one" }));
    expect(mismatch.status).toBe(400);

    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("stores only a bcrypt hash of the new password, never the plaintext", async () => {
    mockGetCurrentUserId.mockResolvedValue("user-1");
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: await bcrypt.hash("old-password-1", 4),
    });

    const res = await PATCH(requestWith(validBody));

    expect(res.status).toBe(200);
    const stored = mockUserUpdate.mock.calls[0][0].data.passwordHash;
    // Hash bcrypt không chứa plaintext, và verify được bằng chính
    // bcrypt.compare — đúng thứ Credentials provider dùng ở authorize().
    expect(stored).not.toBe("new-password-2");
    expect(stored).not.toContain("new-password-2");
    expect(await bcrypt.compare("new-password-2", stored)).toBe(true);
  });
});

describe("GET /api/auth/password", () => {
  beforeEach(() => {
    mockGetCurrentUserId.mockReset();
    mockUserFindUnique.mockReset();
  });

  it("reports hasPassword without ever leaking the hash itself", async () => {
    mockGetCurrentUserId.mockResolvedValue("user-1");
    const passwordHash = await bcrypt.hash("old-password-1", 4);
    mockUserFindUnique.mockResolvedValue({ id: "user-1", passwordHash });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ hasPassword: true });
    // Hash là dữ liệu nhạy cảm — response chỉ được có boolean.
    expect(JSON.stringify(body)).not.toContain(passwordHash);
  });

  it("reports hasPassword=false for a Google account", async () => {
    mockGetCurrentUserId.mockResolvedValue("google-user");
    mockUserFindUnique.mockResolvedValue({ id: "google-user", passwordHash: null });

    const res = await GET();
    const body = await res.json();

    expect(body.data).toEqual({ hasPassword: false });
  });
});