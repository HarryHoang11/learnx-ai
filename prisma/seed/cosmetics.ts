// ================================================================
// SEED — Cosmetic rewards
// ================================================================
// Mạch tư duy: cosmetic là DỮ LIỆU, nên nằm trong DB chứ không hardcode trong
// component. Component chỉ đọc `Reward` + `metadata`.
//
// `costLXP: 0` + `grantAchievement` nghĩa là item được CẤP khi đạt achievement
// tương ứng, không mua bằng LXP. Đường cấp đi qua `grantCosmetic()` — server
// xác minh trước khi cấp.
//
// ASSET: `assetUrl` trỏ `/rewards/...` (file đặt trong `public/`). `icon`
// dùng emoji làm static fallback để UI vẫn hiện được ngay cả khi chưa có
// file SVG.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CosmeticSeed {
  name: string;
  description: string;
  type: "PET" | "AVATAR_FRAME" | "PROFILE_EFFECT" | "CHAT_STICKER" | "CHAT_GIF" | "BADGE";
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  costLXP: number;
  icon: string;
  assetUrl: string;
  width?: number;
  height?: number;
  auraColor?: string;
  /** Achievement mở khoá item này (không có ⇒ mua bằng LXP). */
  grantAchievement?: string;
}

export const COSMETICS: CosmeticSeed[] = [
  // ---- PET ----
  {
    name: "Mèo Học Tập",
    description: "Người bạn đồng hành cùng bạn ôn bài mỗi ngày.",
    type: "PET",
    rarity: "COMMON",
    costLXP: 300,
    icon: "🐱",
    assetUrl: "/rewards/pets/study-cat.svg",
    width: 96,
    height: 96,
  },
  {
    name: "Chó Luyện Tập",
    description: "Không ngừng đưa ra bài tập cho bạn.",
    type: "PET",
    rarity: "RARE",
    costLXP: 800,
    icon: "🐶",
    assetUrl: "/rewards/pets/study-dog.svg",
    width: 96,
    height: 96,
  },
  {
    name: "Cú Đọc Sách",
    description: "Cú vặt nhắc bạn ôn tập đúng giờ.",
    type: "PET",
    rarity: "RARE",
    costLXP: 900,
    icon: "🦉",
    assetUrl: "/rewards/pets/study-owl.svg",
    width: 96,
    height: 96,
  },
  {
    name: "Rồng Nhỏ",
    description: "Rồng tí hon đi cùng người học chăm chỉ.",
    type: "PET",
    rarity: "LEGENDARY",
    costLXP: 2500,
    icon: "🐉",
    assetUrl: "/rewards/pets/mini-dragon.svg",
    width: 128,
    height: 128,
    // Cấp khi đạt "Người Học Marathon" (50 bài học).
    grantAchievement: "LEARNING_MARATHON",
  },
  // ---- AVATAR_FRAME ----
  {
    name: "Khung Nâu",
    description: "Khung viền đơn giản cho mọi hồ sơ.",
    type: "AVATAR_FRAME",
    rarity: "COMMON",
    costLXP: 200,
    icon: "⬜",
    assetUrl: "/rewards/frames/frame-common.svg",
    width: 96,
    height: 96,
  },
  {
    name: "Khung Tinh Vân",
    description: "Vòng sáng lấp lánh quanh ảnh đại diện.",
    type: "AVATAR_FRAME",
    rarity: "EPIC",
    costLXP: 1500,
    icon: "✨",
    assetUrl: "/rewards/frames/frame-stardust.svg",
    width: 96,
    height: 96,
    auraColor: "#7c6cf0",
    // Cấp khi đạt "Chiến Binh Code" (100 bài code).
    grantAchievement: "CODE_WARRIOR",
  },
  // ---- PROFILE_EFFECT ----
  {
    name: "Hào Quang Tím",
    description: "Quầng sáng tím nhạt bao quanh hồ sơ.",
    type: "PROFILE_EFFECT",
    rarity: "RARE",
    costLXP: 1000,
    icon: "🔮",
    assetUrl: "/rewards/effects/aura-purple.svg",
    width: 320,
    height: 320,
    auraColor: "#7c6cf0",
  },
  // ---- CHAT_STICKER ----
  {
    name: "Sticker Hoàn Thành",
    description: "Dán khi bạn vừa chinh phục một bài khó.",
    type: "CHAT_STICKER",
    rarity: "COMMON",
    costLXP: 150,
    icon: "🎉",
    assetUrl: "/rewards/stickers/completed.svg",
    width: 48,
    height: 48,
  },
  {
    name: "Sticker Cố Gắng",
    description: "Lời động viên nhỏ cho bạn bè.",
    type: "CHAT_STICKER",
    rarity: "COMMON",
    costLXP: 150,
    icon: "💪",
    assetUrl: "/rewards/stickers/keep-going.svg",
    width: 48,
    height: 48,
  },
  // ---- BADGE ----
  {
    name: "Huy Hiệu Người Mới",
    description: "Dấu ấn cho những bước đầu tiên.",
    type: "BADGE",
    rarity: "COMMON",
    costLXP: 0,
    icon: "🌱",
    assetUrl: "/rewards/badges/newcomer.svg",
    width: 32,
    height: 32,
    grantAchievement: "FIRST_LESSON",
  },
];
async function main() {
  console.log(`Seeding ${COSMETICS.length} cosmetic rewards…\n`);

  for (const c of COSMETICS) {
    const metadata = {
      assetUrl: c.assetUrl,
      width: c.width,
      height: c.height,
      auraColor: c.auraColor,
      // Không có `grantAchievement` ⇒ mua bằng LXP trong shop.
      grantAchievement: c.grantAchievement ?? null,
    };

    // `Reward.name` chưa có `@unique`, nên định danh bằng name là cách duy
    // nhất hiện có mà không cần migration thêm. Idempotent: chạy lại seed chỉ
    // cập nhật, không nhân bản.
    const existing = await prisma.reward.findFirst({ where: { name: c.name } });
    const data = {
      description: c.description,
      type: c.type,
      rarity: c.rarity,
      costLXP: c.costLXP,
      icon: c.icon,
      imageUrl: c.assetUrl,
      requirements: metadata,
      stock: null,
      active: true,
    };

    if (existing) {
      await prisma.reward.update({ where: { id: existing.id }, data });
      console.log(`  ~ ${c.name} (cập nhật)`);
    } else {
      await prisma.reward.create({ data: { ...data, name: c.name } });
      console.log(`  + ${c.name}`);
    }
  }

  console.log("\nXong. Cosmetic được cấp khi đạt achievement (grantAchievement) hoặc");
  console.log("đổi bằng LXP tại /rewards nếu costLXP > 0.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());