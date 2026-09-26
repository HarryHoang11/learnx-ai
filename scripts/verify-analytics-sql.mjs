// Kiểm chứng SQL aggregation của analytics bằng DB THẬT (không mock).
// Chạy: node scripts/verify-analytics-sql.mjs
// Script chỉ ĐỌC — không ghi, không xóa dữ liệu nào.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let userId = process.argv[2];

function show(label, value) {
  console.log(`  ${label}: ${JSON.stringify(value)}`);
}

try {
  const n = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM "User" WHERE ${userId ? `"id" = $1` : `TRUE`}`,
    ...(userId ? [userId] : [])
  );
  console.log(`[OK] DB ket noi. User${userId ? ` ${userId}` : " tong"}:`, n[0].c);

  // Tu dong tim user co du lieu hoc tap de kiem chung co so.
  if (!userId) {
    const rich = await prisma.$queryRawUnsafe(
      `SELECT "userId", COUNT(*)::int AS n FROM "LearningSession" GROUP BY 1 ORDER BY n DESC LIMIT 1`
    );
    if (rich.length) {
      userId = rich[0].userId;
      console.log(`  -> dung user co du lieu: ${userId} (${rich[0].n} phien)`);
    } else {
      // DB dev chua co LearningSession -> dung user co Attempt de kiem §9.
      const withAttempts = await prisma.$queryRawUnsafe(
        `SELECT "userId", COUNT(*)::int AS n FROM "Attempt" GROUP BY 1 ORDER BY n DESC LIMIT 1`
      );
      if (withAttempts.length) {
        userId = withAttempts[0].userId;
        console.log(`  -> dung user co Attempt: ${userId} (${withAttempts[0].n} cau)`);
      }
    }
  }

  // §8 — phan bo thoi gian theo mon
  const rows = await prisma.$queryRaw`
    SELECT "subject",
           COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE("completedAt", "startedAt") - "startedAt")) / 60), 0)::float AS minutes,
           COUNT(*)::int AS sessions
    FROM "LearningSession"
    WHERE "userId" = ${userId ?? ""}::text
    GROUP BY "subject"
    HAVING COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE("completedAt", "startedAt") - "startedAt")) / 60), 0) > 0
    ORDER BY minutes DESC
    LIMIT 8
  `;
  show("§8 subject time share (dong)", rows.length);

  // §9 — dung / sai
  const out = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(c.correct), 0)::int  AS correct,
      COALESCE(SUM(c.total - c.correct), 0)::int AS incorrect
    FROM (
      SELECT COUNT(*)::int AS total,
             COALESCE(SUM(CASE WHEN "isCorrect" THEN 1 ELSE 0 END), 0)::int AS correct
      FROM "Attempt" WHERE "userId" = ${userId ?? ""}::text
      UNION ALL
      SELECT COUNT(*)::int AS total,
             COALESCE(SUM(CASE WHEN "isCorrect" THEN 1 ELSE 0 END), 0)::int AS correct
      FROM "ExerciseAttempt" WHERE "userId" = ${userId ?? ""}::text
    ) AS c
  `;
  show("§9 outcomes", out[0]);

  const abandoned = await prisma.learningSession.count({
    where: { userId: userId ?? "", completedAt: null, questionsAnswered: { gt: 0 } },
  });
  show("§9 abandoned sessions", abandoned);

  // Đếm dữ liệu thật của các bảng nguồn — để biết dev DB có dữ liệu hay chưa,
  // và §9/§8 có gì để hiển thị thật không.
  console.log("  -- so lieu thuc trong DB --");
  for (const table of [
    "Attempt",
    "ExerciseAttempt",
    "LearningSession",
    "LearningProgress",
    "XPTransaction",
  ]) {
    const c = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM ${'"'}${table}${'"'}`
    );
    show(table, c[0].c);
  }
} catch (e) {
  console.log("[FAIL]", e.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
