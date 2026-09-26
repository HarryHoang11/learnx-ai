-- Welcome Experience / onboarding state.
--
-- Cố ý CHỈ thêm phần onboarding: `prisma migrate diff` so với HEAD còn sinh
-- thêm vài CREATE INDEX cho bảng Attempt/LearningSession — đó là chênh lệch
-- có sẵn từ trước, không thuộc thay đổi này. Nếu đưa vào đây thì lên
-- production (DB đã có sẵn index) sẽ lỗi "relation already exists".
--
-- Cột mới đều nullable/default nên migration chạy trên bảng User đang có
-- dữ liệu là an toàn, không cần backfill: mọi user cũ coi như đã onboarding
-- (welcomeSeenAt NULL + status EXPLORING/NEW xử lý ở tầng logic).
CREATE TYPE "OnboardingStatus" AS ENUM ('NEW', 'EXPLORING', 'SETTING_UP', 'PERSONALIZED');

ALTER TABLE "User"
ADD COLUMN "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "welcomeSeenAt" TIMESTAMP(3),
ADD COLUMN "firstLearningSessionAt" TIMESTAMP(3),
ADD COLUMN "learningProfile" JSONB;
-- BACKFILL BAT BUOC -- neu bo qua, moi user cu se bi coi la "moi" va bi keo
-- lai /welcome o lan dang nhap ke tiep, dung thu can tranh (returning user
-- phai vao thang Dashboard).
--
-- Cach xac dinh user cu: da co hanh dong hoc that (bai lam / tai lieu /
-- lo trinh) hoac da kiem XP. User tao ma chua lam gi thi de NEW -- ho xung
-- dang duoc thay Welcome.
UPDATE "User" u
SET "onboardingStatus" = 'EXPLORING',
    "welcomeSeenAt" = COALESCE(u."createdAt", NOW())
WHERE u."onboardingStatus" = 'NEW'
  AND (
    EXISTS (SELECT 1 FROM "Attempt" a WHERE a."userId" = u."id")
    OR EXISTS (SELECT 1 FROM "Document" d WHERE d."userId" = u."id")
    OR EXISTS (SELECT 1 FROM "Roadmap" r WHERE r."userId" = u."id")
    OR u."lifetimeXP" > 0
  );