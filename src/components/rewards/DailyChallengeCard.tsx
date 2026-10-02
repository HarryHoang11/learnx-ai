// ================================================================
// <DailyChallengeCard /> — thẻ thử thách hôm nay
// ================================================================
// Mạch tư duy: thử thách ngày là "động lực nhỏ mỗi ngày" — nằm ngay trên
// Dashboard và trang Đổi thưởng. API (/api/daily-challenge) đã có sẵn và
// TỰ SINH challenge nếu hôm nay chưa có, nên UI không cần logic tạo mới.
//
// Vì sao tách riêng: cần xuất hiện ở 2 nơi (Dashboard + Rewards) với cùng
// hành vi claim, nên gom 1 component thay vì copy 2 lần.
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { I18nKey } from "@/lib/i18n/dictionary";
import { buildChallengeState, type DailyChallengeData } from "@/types";
import type { ReactNode } from "react";

interface DailyChallengeCardProps {
  challenge: DailyChallengeData | null;
  /** Đang gọi /api/daily-challenge/claim — khoá nút để không bấm 2 lần. */
  claiming: boolean;
  onClaim: () => void;
}

/**
 * Nhãn cho `challengeType` — giá trị do `generateDailyChallenge()` sinh
 * (xem services/calendar.service.ts). Map sang key i18n để không lộ chuỗi
 * kỹ thuật ("exercise_hard") ra UI.
 *
 * Trả về `I18nKey` (union type từ dictionary) nên key không tồn tại sẽ bị
 * TypeScript bắt ngay tại đây thay vì lúc chạy.
 *
 * `target` được truyền vào vì các key này chứa placeholder `{n}` — gửi
 * `targetCount` thật. Trước đây chuỗi ghi cứng chữ "N" nên hiện
 * "Giải N bài tập" (bug template variable).
 */
function challengeLabelKey(type: string): I18nKey {
  switch (type) {
    case "lesson":
      return "challenge.lesson";
    case "exercise":
      return "challenge.exercise";
    case "quiz":
      return "challenge.quiz";
    case "review":
      return "challenge.review";
    default:
      return "challenge.inProgress";
  }
}

export default function DailyChallengeCard({ challenge, claiming, onClaim }: DailyChallengeCardProps) {
  const { t } = useLanguage();

  /**
   * Trạng thái ĐÃ CHUẨN HOÁ — quy tắc duy nhất cho mọi thứ hiển thị.
   *
   * KHÔNG đọc `challenge.completed` (boolean từ DB) ở đây nữa: cột boolean
   * đó được `checkAndUpdateDailyChallenge` ghi riêng và có thể lệch với
   * `completedCount`, sinh ra bug "0/5 nhưng báo Đã hoàn thành". Mọi quyết
   * định giờ đi qua `buildChallengeState` (xem src/types/index.ts).
   */
  const state = buildChallengeState(challenge);

  // Chưa có challenge (API lỗi hoặc user mới chưa học gì) -> empty state có
  // mô tả, không render card rỗng.
  if (!challenge || !state) {
    return (
      <section className="challenge-card challenge-card--empty">
        <div className="challenge-card__head">
          <span className="challenge-card__title">{t("challenge.empty")}</span>
        </div>
        <p className="challenge-card__desc">{t("challenge.emptyDesc")}</p>
      </section>
    );
  }

  const { target, completed, remaining, percent, isCompleted, isClaimed, hasTarget } = state;

  /**
   * Trạng thái hiển thị — TÁCH RIÊNG 2 khái niệm (spec §12):
   *   "đã nhận thưởng" (isClaimed) khác "đã hoàn thành" (isCompleted).
   *   Chỉ được hiện nút claim khi ĐÃ hoàn thành và CHƯA nhận.
   *
   * spec §12 yêu cầu 4 trạng thái rõ ràng — mỗi nhánh là MỘT khối, không
   * trộn nhãn:
   *   0/target  → "Bắt đầu thử thách"   (chưa làm gì)
   *   n/target  → "Còn {n} nữa"           (đang làm)
   *   = /target → "✓ Đã hoàn thành!" + nút nhận
   *   claimed   → "✓ Đã nhận thưởng"
   */
  let statusNode: ReactNode;
  if (isClaimed) {
    statusNode = (
      <span className="challenge-card__badge challenge-card__badge--done">
        <span className="challenge-card__check" aria-hidden="true">
          ✓
        </span>
        {t("challenge.claimed")}
      </span>
    );
  } else if (isCompleted) {
    // Badge "Đã hoàn thành" + nút claim là HAI phần tử riêng. Bản trước chỉ
    // render nút claim nên người dùng không thấy rõ "đã xong" (spec §12).
    statusNode = (
      <span className="challenge-card__status">
        <span className="challenge-card__badge challenge-card__badge--done">
          <span className="challenge-card__check" aria-hidden="true">
            ✓
          </span>
          {t("challenge.completed")}
        </span>
        <button
          type="button"
          className="btn-primary challenge-card__btn"
          disabled={claiming}
          onClick={onClaim}
        >
          {claiming ? t("rewards.redeeming") : t("challenge.claim")}
        </button>
      </span>
    );
  } else if (completed === 0) {
    // spec §12: 0/target = "Bắt đầu thử thách" (hành động), không phải
    // "Chưa bắt đầu" (trạng thái vô nghĩa khi ai cũng chưa làm gì).
    statusNode = (
      <span className="challenge-card__badge challenge-card__badge--muted">
        {t("challenge.start")}
      </span>
    );
  } else {
    // CHƯA hoàn thành: chỉ nói số còn lại, KHÔNG bao giờ hiện "Đã hoàn thành!".
    // Đây là chỗ bản cũ render nhầm `t("challenge.completed")`.
    statusNode = (
      <span className="challenge-card__badge challenge-card__badge--muted">
        {t("challenge.remaining", { n: String(remaining) })}
      </span>
    );
  }

  return (
    <section
      className={`challenge-card${isCompleted ? " is-complete" : ""}${isClaimed ? " is-claimed" : ""}`}
      aria-label={t("challenge.title")}
    >
      <div className="challenge-card__head">
        <div className="challenge-card__head-text">
          <span className="challenge-card__eyebrow">{t("challenge.title")}</span>
          {/* Số mục tiêu THẬT từ `targetCount` — có target mới truyền `n`,
              không có thì dùng nhãn chung (tránh render "0 bài tập"). */}
          <h3 className="challenge-card__title">
            {hasTarget
              ? t(challengeLabelKey(challenge.challengeType), { n: String(target) })
              : t("challenge.inProgress")}
          </h3>
        </div>
        {/* Đếm tách riêng khỏi tiêu đề, luôn có khoảng cách (xem CSS). */}
        <span className="challenge-card__count">
          {t("challenge.progress", {
            done: String(completed),
            target: String(target),
          })}
        </span>
      </div>

      {/* Thanh tiến độ dùng transform: scaleX (GPU) thay vì width — animation
          mượt trên máy yếu, không kích hoạt layout. */}
      <div
        className="challenge-card__track"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label={t("challenge.progressAria", {
          done: String(completed),
          target: String(target),
        })}
      >
        <span className="challenge-card__fill" style={{ transform: `scaleX(${percent / 100})` }} />
      </div>

      <div className="challenge-card__foot">
        {/* Phần thưởng và trạng thái là HAI khối riêng, CSS `gap` đảm bảo
            không dính chuỗi (bug "Thưởng 40 XP · 20 LXPĐã hoàn thành!"). */}
        <span className="challenge-card__reward">
          {t("challenge.reward", {
            xp: String(challenge.xpReward),
            lxp: String(challenge.lxpReward),
          })}
        </span>
        {statusNode}
      </div>
    </section>
  );
}