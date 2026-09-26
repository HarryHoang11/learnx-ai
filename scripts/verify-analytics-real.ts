// Script kiểm chứng analytics trên DB THẬT (không mock).
// Mục tiêu: chứng minh số liệu khớp truy vấn SQL thô, và các edge case
// mới (range 14d, filter, groupBy filterOptions, chẩn đoán nền tảng) không
// sinh số 0 giả hay thiếu option.
//
// Chạy: npx tsx scripts/verify-analytics-real.ts
import { PrismaClient } from "@prisma/client";
import { getLearningAnalytics } from "../src/services/analytics/learning-analytics.service";
import { buildDeterministicInsight } from "../src/services/analytics/insights";
import { parseAnalyticsFilters } from "../src/services/analytics/filters";

const prisma = new PrismaClient();

function ok(cond: boolean, label: string, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` -> ${detail}` : ""}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  // CHỈ select cột cần dùng: DB dev đang thiếu `User.onboardingStatus`
  // (migration `add_onboarding_welcome` chưa apply) nên `findFirst` không
  // chỉ định select sẽ kéo cả cột đó và fail trước cả khi script kịp chạy.
  const user = await prisma.user.findFirst({
    where: { attempts: { some: {} } },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!user) {
    console.log("Không có user nào có Attempt — hãy seed trước.");
    return;
  }
  console.log(`User: ${user.id} (${user.email})\n`);

  // ---- 1. Số liệu lõi khớp SQL thô -------------------------------
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 864e5);
  const [raw, payload] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId: user.id, createdAt: { gte: since, lt: now } },
      select: { isCorrect: true },
    }),
    getLearningAnalytics(user.id, "30d"),
  ]);
  const expectedAcc = raw.length
    ? Math.round((raw.filter((a) => a.isCorrect).length / raw.length) * 100)
    : null;
  ok(
    payload.accuracy.overall === expectedAcc,
    "accuracy khớp SQL thô",
    `service=${payload.accuracy.overall} sql=${expectedAcc} (n=${raw.length})`
  );
  ok(payload.totalAttempts === raw.length, "totalAttempts khớp", `${payload.totalAttempts} vs ${raw.length}`);

  // ---- 2. range 14d là cửa sổ THẬT, không rơi về 30d --------------
  const p14 = await getLearningAnalytics(user.id, "14d");
  ok(p14.range === "14d", "range 14d được giữ", p14.range);
  const d14 = await prisma.attempt.count({
    where: { userId: user.id, createdAt: { gte: new Date(now.getTime() - 14 * 864e5), lt: now } },
  });
  const n14 = p14.accuracy.bySubject.reduce((s, x) => s + x.attempts, 0);
  ok(n14 === d14, "14d đếm đúng số attempt trong 14 ngày", `service=${n14} sql=${d14}`);

  // ---- 3. Filter thật sự lọc ------------------------------------
  const subject = payload.filterOptions.subjects[0];
  if (subject) {
    const pFiltered = await getLearningAnalytics(
      user.id, "all", parseAnalyticsFilters(new URLSearchParams({ subject }))
    );
    const sqlRows = await prisma.attempt.groupBy({
      by: ["subject"], where: { userId: user.id }, _count: { _all: true },
    });
    const expectedN = sqlRows.find((r) => r.subject === subject)?._count._all ?? 0;
    const gotN = pFiltered.accuracy.bySubject.reduce((s, x) => s + x.attempts, 0);
    ok(gotN === expectedN, `filter subject="${subject}" khớp SQL`, `service=${gotN} sql=${expectedN}`);
    ok(
      pFiltered.accuracy.bySubject.every((x) => x.subject === subject),
      "filter không rò môn khác"
    );

    // groupBy phải trả ĐỦ topic, không phải 1 topic/môn như `distinct`.
    const sqlTopics = new Set(
      (await prisma.attempt.findMany({ where: { userId: user.id, subject }, select: { topic: true } })).map((r) => r.topic)
    );
    ok(
      pFiltered.filterOptions.topics.length === sqlTopics.size,
      "groupBy trả đủ topic của môn",
      `${pFiltered.filterOptions.topics.length} vs ${sqlTopics.size}`
    );
  } else {
    console.log("SKIP  filter (user chưa có môn nào)");
  }


  // ---- 4. Difficulty hợp lệ; giá trị rác bị loại ------------------
  const dF = await getLearningAnalytics(user.id, "all", parseAnalyticsFilters(new URLSearchParams({ difficulty: "hard" })));
  ok(
    dF.accuracy.byDifficulty.every((d) => d.difficulty === "hard"),
    "difficulty=hard chỉ trả bài hard"
  );
  ok(
    parseAnalyticsFilters(new URLSearchParams({ difficulty: "'; DROP TABLE--" })).difficulty === undefined,
    "difficulty rác bị loại (không nội suy SQL)"
  );

  // ---- 5. filterOptions lấy theo TOÀN BỘ lịch sử ------------------
  const p7 = await getLearningAnalytics(user.id, "7d");
  ok(
    p7.filterOptions.subjects.length === payload.filterOptions.subjects.length,
    "đổi range không làm mất option filter",
    `${p7.filterOptions.subjects.length} vs ${payload.filterOptions.subjects.length}`
  );

  // ---- 6. Cơ cấu hoạt động khớp LearningActivity -------------------
  const mixSql = await prisma.learningActivity.groupBy({
    by: ["type"],
    where: { userId: user.id, occurredAt: { gte: since, lt: now } },
    _count: { _all: true },
  });
  const mixTotal = mixSql.reduce((s, r) => s + r._count._all, 0);
  const svcTotal = payload.activityMix.reduce((s, r) => s + r.count, 0);
  ok(svcTotal === mixTotal, "activityMix khớp LearningActivity", `service=${svcTotal} sql=${mixTotal}`);

  // ---- 7. Chẩn đoán nền tảng --------------------------------------
  const first = await prisma.assessment.findFirst({
    where: { userId: user.id, completedAt: { not: null } },
    orderBy: { startedAt: "asc" },
    select: { id: true },
  });
  console.log(`\nBaseline assessment: ${first ? first.id : "KHÔNG CÓ"}`);
  ok(
    payload.sinceAssessment.hasBaseline === Boolean(first),
    "hasBaseline khớp với Assessment đầu tiên",
    `service=${payload.sinceAssessment.hasBaseline} sql=${Boolean(first)}`
  );
  for (const r of payload.sinceAssessment.rows) {
    ok(
      r.current - r.baseline === r.changePp,
      `changePp khớp ${r.topic}`,
      `${r.baseline} -> ${r.current} = ${r.changePp}`
    );
    ok(r.baseline >= 0 && r.baseline <= 100, "baseline là % hợp lệ", `${r.baseline}`);
  }

  // ---- 8. Insight: trends/warning tách biệt, không bịa số ----------
  const insight = buildDeterministicInsight(payload);
  ok(Array.isArray(insight.trends), "insight có mảng trends");
  ok(insight.warning === null || typeof insight.warning === "string", "warning là chuỗi hoặc null");
  ok(insight.source === "deterministic", "nguồn insight là deterministic");
  console.log(`\nTrends: ${JSON.stringify(insight.trends, null, 2)}`);
  console.log(`Warning: ${insight.warning ?? "(none)"}`);

  // ---- 9. User mới: KHÔNG có số 0 giả -----------------------------
  const fresh = await prisma.user.findFirst({
    where: { attempts: { none: {} } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (fresh) {
    const fp = await getLearningAnalytics(fresh.id, "30d");
    ok(fp.accuracy.overall === null, "user mới: accuracy null (không phải 0)", String(fp.accuracy.overall));
    ok(fp.availability !== "ready", "user mới: không ở trạng thái 'ready'", fp.availability);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
