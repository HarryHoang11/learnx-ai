-- Thêm unique constraint cho (userId, sourceType, sourceId) trên XPTransaction
-- để ngăn chặn XP/LXP farming qua các cuộc gọi API lặp lại.
CREATE UNIQUE INDEX "XPTransaction_userId_sourceType_sourceId_unique"
ON "XPTransaction" ("userId", "sourceType", "sourceId");