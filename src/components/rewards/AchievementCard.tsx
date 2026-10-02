// ================================================================
// <AchievementCard /> — 1 thẻ thành tựu
// ================================================================
// Mạch tư duy: achievement là "cột mốc" nên cần cảm giác khác biệt rõ rệt:
// đã mở khoá thì ĐẦY MÀU + icon nổi; chưa đạt thì MỜ + viền mảnh (nhìn
// thấy "còn ở xa") — nhưng vẫn hiện điều kiện để người học biết cần làm gì.
// Đây là mảnh ghép động lực quan trọng nhất sau streak.
import Badge from "@/components/ui/Badge";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { I18nKey } from "@/lib/i18n/dictionary";
import type { AchievementWithProgress } from "@/types";

interface AchievementCardProps {
  achievement: AchievementWithProgress;
}

/**
 * Mô tả điều kiện của achievement từ `condition` (xem
 * ACHIEVEMENT_DEFINITIONS trong services/achievement.service.ts).
 *
 * VÌ SAO CẦN: `getAchievementProgress()` hiện trả `progress: 0` cho mọi
 * achievement (có TODO trong service) — tức là backend CHƯA tính được phần
 * trăm. Thay vì hiện "0%" giả (nói dối người dùng), ta hiển thị ĐIỀU KIỆN
 * thật lấy từ `condition` — đó là dữ liệu thật từ DB, không bịa.
 * Khi service tính được `progress`, chỉ cần đổi 1 chỗ render ở đây.
 */
function conditionText(achievement: AchievementWithProgress, t: (k: I18nKey, p?: Record<string, string>) => string): string | null {
  const c = achievement.condition;
  switch (c.type) {
    case "streak_days":
      return t("achievements.cond.streakDays", { n: String(c.days ?? 0) });
    case "lessons_completed":
      return t("achievements.cond.lessons", { n: String(c.count ?? 0) });
    case "problems_solved":
      return t("achievements.cond.solved", { n: String(c.count ?? 0) });
    case "review_completed":
      return t("achievements.cond.reviews", { n: String(c.count ?? 0) });
    case "document_analyzed":
      return t("achievements.cond.docs", { n: String(c.count ?? 0) });
    case "topic_mastered":
      return t("achievements.cond.mastery", { n: String(c.threshold ?? 0) });
    case "xp_earned":
      return t("achievements.cond.xp", { n: String(c.amount ?? 0) });
    case "level_reached":
      return t("achievements.cond.level", { n: String(c.level ?? 0) });
    case "first_lesson":
      return t("achievements.cond.firstLesson");
    case "first_solve":
      return t("achievements.cond.firstSolve");
    case "diagnostic_completed":
      return t("achievements.cond.diagnostic");
    case "mindmap_created":
      return t("achievements.cond.mindmap");
    case "roadmap_completed":
      return t("achievements.cond.roadmap");
    default:
      return null;
  }
}

/**
 * Tách phần thưởng thành các PHẦN TỬ riêng thay vì nối chuỗi (spec §5).
 *
 * LÝ DO: bản cũ viết `+{xp} XP · +{lxp} LXP` trong MỘC text node. Khi
 * `xpReward`/`lxpReward` là `null`/`undefined`/`NaN` (DB cũ, service chưa set,
 * hoặc response thiếu field) chuỗi thành `+- - +null LXP` — đúng lỗi
 * "+300 XP - - +100 LXP" mà người dùng báo.
 *
 * Nay mỗi phần là phần tử riêng, `·` là node độc lập, và separator chỉ hiện
 * khi THỰC SỰ có cả hai loại phần thưởng.
 *
 * `Number.isFinite` + `> 0` để loại cả 0, null, undefined, NaN — số 0 phần
 * thưởng không có nghĩa mà hiện ra thì thành "+0 XP".
 */
export function rewardParts(
  achievement: Pick<AchievementWithProgress, "xpReward" | "lxpReward">
): { xp: number | null; lxp: number | null } {
  const xp = Number(achievement.xpReward);
  const lxp = Number(achievement.lxpReward);
  return {
    xp: Number.isFinite(xp) && xp > 0 ? xp : null,
    lxp: Number.isFinite(lxp) && lxp > 0 ? lxp : null,
  };
}

export default function AchievementCard({ achievement }: AchievementCardProps) {
  const { t } = useLanguage();
  const { unlocked } = achievement;
  const condition = conditionText(achievement, t);
  const { xp, lxp } = rewardParts(achievement);
  const hasXp = xp !== null;
  const hasLxp = lxp !== null;

  return (
    <article
      className={`ach-card${unlocked ? " is-unlocked" : " is-locked"}`}
      // aria: trạng thái khoá rõ ràng, screen reader đọc được.
      aria-label={`${achievement.title} — ${unlocked ? t("achievements.unlocked") : t("achievements.locked")}`}
    >
      {/* Hàng đầu: icon + tiêu đề CÙNG HÀNG (spec §4). Bản cũ để icon là
          block 84px cao ở trên, emoji rơi thành dòng riêng tách khỏi tên —
          nhìn như element rơi vào từ trình duyệt. Grid 2 cột giữ icon bám
          trái, tiêu đề bám phải, tự wrap khi tiêu đề dài. */}
      <header className="ach-card__top">
        <span className="ach-card__emblem" aria-hidden="true">
          <span className="ach-card__glyph">{achievement.icon ?? "🏅"}</span>
        </span>
        <h3 className="ach-card__title">{achievement.title}</h3>
        {!unlocked && (
          <span className="ach-card__lock" aria-hidden="true">
            🔒
          </span>
        )}
      </header>

      <div className="ach-card__body">
        <p className="ach-card__desc">{achievement.description}</p>
        {condition && <p className="ach-card__cond">{condition}</p>}
      </div>

      {/* Chân thẻ: phần thưởng (flex wrap) + badge trạng thái là 2 khối riêng
          biệt, có `gap` — không dính text node (spec §6, §15). */}
      <div className="ach-card__foot">
        {(hasXp || hasLxp) && (
          <span className="ach-card__reward">
            {hasXp && <span className="ach-card__amount">{`+${xp} XP`}</span>}
            {hasXp && hasLxp && (
              <span className="ach-card__sep" aria-hidden="true">
                ·
              </span>
            )}
            {hasLxp && <span className="ach-card__amount">{`+${lxp} LXP`}</span>}
          </span>
        )}
        {unlocked ? (
          <Badge tone="green">
            <span className="ach-card__check" aria-hidden="true">
              ✓
            </span>
            {t("achievements.unlocked")}
          </Badge>
        ) : (
          <Badge tone="neutral">{t("achievements.locked")}</Badge>
        )}
      </div>
    </article>
  );
}