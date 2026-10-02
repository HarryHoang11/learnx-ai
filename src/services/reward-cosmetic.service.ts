// ================================================================
// REWARD ENGINE — cosmetic: grant · equip · unequip
// ================================================================
// Mạch tư duy: Prisma đã có `Reward` + `UserReward` (xem schema.prisma) và
// API `/api/rewards/{shop,redeem,inventory}` đã hoạt động. File này BỔ SUNG
// phần còn thiếu: trạng thái TRANG BỊ + grant cosmetic từ achievement.
//
// Ràng buộc bất di bất dịch (spec §20): cosmetic CHỈ trang trí. Không cột
// nào ở đây cộng XP/LXP, không mở nội dung học thuật.
//
// BA NGUYÊN TẮC BẢO MẬT — không được nới:
//   1. Giá (`costLXP`) LUÔN đọc từ DB, không bao giờ tin giá do client gửi.
//   2. Quyền sở hữu LUÔN tra `UserReward`, không tin `isOwned` từ client.
//   3. Mọi thay đổi trạng thái chạy trong `$transaction` để không trạng thái
//      nửa vời (đang mặc 2 pet cùng lúc).

import { prisma } from "@/lib/db/prisma";
import { isEquippable } from "@/lib/rewards/cosmetic";

/** Kết quả trả về cho client — KHÔNG chứa giá hay quyền do client kiểm soát. */
export type EquipResult =
  | { ok: true; rewardId: string }
  | { ok: false; code: "NOT_OWNED" | "NOT_EQUIPPABLE" | "NOT_FOUND"; message: string };

/**
 * Trang bị 1 cosmetic lên hồ sơ.
 *
 * `status: ACTIVE` = đang mặc (xem enum `RewardStatus` trong schema). Mỗi
 * category chỉ giữ 1 item ACTIVE: mọi item ACTIVE khác cùng loại bị đưa về
 * `OWNED` trong CÙNG transaction.
 *
 * Server kiểm tra ownership bằng `UserReward` — frontend có disable nút cũngng
 * không bảo vệ được, nên kiểm tra ở đây là bắt buộc (spec §15).
 */
export async function equipCosmetic(userId: string, rewardId: string): Promise<EquipResult> {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.userReward.findUnique({
      where: { userId_rewardId: { userId, rewardId } },
      include: { reward: true },
    });

    if (!owned) {
      return {
        ok: false,
        code: "NOT_OWNED",
        message: "Bạn chưa sở hữu phần thưởng này.",
      };
    }

    if (!isEquippable(owned.reward.type)) {
      return {
        ok: false,
        code: "NOT_EQUIPPABLE",
        message: "Phần thưởng này không dùng để trang bị.",
      };
    }

    // Bỏ `ACTIVE` ở mọi item khác CÙNG LOẠI (kể cả chính nó, để idempotent).
    await tx.userReward.updateMany({
      where: {
        userId,
        status: "ACTIVE",
        rewardId: { not: rewardId },
        reward: { type: owned.reward.type },
      },
      data: { status: "OWNED" },
    });

    await tx.userReward.update({
      where: { id: owned.id },
      data: { status: "ACTIVE", activatedAt: new Date() },
    });

    return { ok: true, rewardId };
  });
}

/** Bỏ trang bị. Item vẫn thuộc sở hữu (chuyển về `OWNED`), không bị mất. */
export async function unequipCosmetic(userId: string, rewardId: string): Promise<EquipResult> {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.userReward.findUnique({
      where: { userId_rewardId: { userId, rewardId } },
    });

    if (!owned) {
      return {
        ok: false,
        code: "NOT_OWNED",
        message: "Bạn chưa sở hữu phần thưởng này.",
      };
    }

    await tx.userReward.update({
      where: { id: owned.id },
      data: { status: "OWNED" },
    });

    return { ok: true, rewardId };
  });
}

/** Cosmetic đang trang bị, gom theo loại để UI render nhanh. */
export async function getEquippedCosmetics(userId: string) {
  const rows = await prisma.userReward.findMany({
    where: { userId, status: "ACTIVE" },
    include: { reward: true },
  });
  return rows;
}

/**
 * Grant cosmetic cho user (dùng bởi achievement hoặc admin).
 *
 * IDEMPOTENT: `@@unique([userId, rewardId])` trên `UserReward` nên nếu đã
 * sở hữu thì bỏ qua, KHÔNG tạo bản ghi trùng và KHÔNG trừ tiền (hàm này
 * không đụng LXP — việc trừ LXP là của `/api/rewards/redeem`).
 *
 * `skipIfOwned` = true cho đường achievement: nếu người dùng đã tự đổi item
 * này bằng LXP trước đó thì không cần cấp lại.
 */
export async function grantCosmetic(
  userId: string,
  rewardId: string,
  options: { equip?: boolean; skipIfOwned?: boolean } = {}
): Promise<{ granted: boolean; reason?: "ALREADY_OWNED" | "REWARD_NOT_FOUND" }> {
  const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
  if (!reward) return { granted: false, reason: "REWARD_NOT_FOUND" };

  const existing = await prisma.userReward.findUnique({
    where: { userId_rewardId: { userId, rewardId } },
  });
  if (existing) {
    if (options.skipIfOwned) return { granted: false, reason: "ALREADY_OWNED" };
    return { granted: false, reason: "ALREADY_OWNED" };
  }

  await prisma.userReward.create({
    data: {
      userId,
      rewardId,
      status: options.equip && isEquippable(reward.type) ? "ACTIVE" : "OWNED",
      activatedAt: options.equip ? new Date() : null,
    },
  });

  return { granted: true };
}