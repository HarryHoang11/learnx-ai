-- Mở rộng enum RewardType với 6 loại cosmetic.
--
-- VÌ SAO AN TOÀN: `ALTER TYPE ... ADD VALUE` KHÔNG xoá/sửa dữ liệu đang có.
-- Các Reward cũ (DIGITAL / LEARNING / REAL_WORLD / MILESTONE) giữ nguyên giá
-- trị và vẫn đọc được. Không có bước nào rewrite bảng.
--
-- Ghi chú PostgreSQL: ADD VALUE không dùng được trong cùng transaction nếu
-- cần dùng ngay giá trị mới — migration này chỉ ADD, không INSERT nên an toàn.

ALTER TYPE "RewardType" ADD VALUE IF NOT EXISTS 'PET';
ALTER TYPE "RewardType" ADD VALUE IF NOT EXISTS 'AVATAR_FRAME';
ALTER TYPE "RewardType" ADD VALUE IF NOT EXISTS 'PROFILE_EFFECT';
ALTER TYPE "RewardType" ADD VALUE IF NOT EXISTS 'CHAT_STICKER';
ALTER TYPE "RewardType" ADD VALUE IF NOT EXISTS 'CHAT_GIF';
ALTER TYPE "RewardType" ADD VALUE IF NOT EXISTS 'BADGE';