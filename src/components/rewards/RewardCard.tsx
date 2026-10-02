// ================================================================
// <RewardCard /> — 1 thẻ phần thưởng trong cửa hàng
// ================================================================
// Mạch tư duy: đây là đơn vị lặp lại nhiều lần trong shop, nên tách riêng để
// không lặp 5 lần cùng một cấu trúc ở page. Nó CỐ TÌNH "thẳng thắn":
//   - Đủ LXP  -> nút Đổi bật, kèm giá.
//   - Chưa đủ  -> nút vô hiệu HOẠT nhưng vẫn hiện rõ "cần thêm N LXP" để
//     người dùng biết mục tiêu (biến 1 thẻ vô dụng thành động lực).
//   - Đã sở hữu -> nút chuyển thành nhãn trạng thái, không bấm được.
//   - Hết hàng  -> nút vô hiệu + ghi chú tồn kho.
// Toàn bộ dữ liệu (canAfford/isOwned/stock) do SERVER tính sẵn và trả kèm
// (xem ShopReward trong @/types) — component không tự suy đoán từ lxpBalance.
import Badge from "@/components/ui/Badge";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import type { Rarity } from "@/components/ui/Badge";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { I18nKey } from "@/lib/i18n/dictionary";
import type { ShopReward } from "@/types";

interface RewardCardProps {
  reward: ShopReward;
  /** Số dư LXP hiện tại — chỉ dùng để tính "cần thêm N LXP" hiển thị cho
   *  người dùng. Quyết định bấm được hay không vẫn theo `reward.canAfford`
   *  do server tính (không lệch khi server từ chối). */
  balance: number;
  /** Đang gọi API cho đúng reward này -> hiện trạng thái loading trên nút. */
  redeeming: boolean;
  onRedeem: (reward: ShopReward) => void;
}

export default function RewardCard({ reward, balance, redeeming, onRedeem }: RewardCardProps) {
  const { t } = useLanguage();

  const outOfStock = reward.stock !== null && reward.stock <= 0;
  const disabled = !reward.canAfford || outOfStock || redeeming;
  const missing = Math.max(0, reward.costLXP - balance);

  // Nhãn trạng thái theo `userStatus` (giá trị ảo NOT_OWNED do server gán).
  const statusKey: I18nKey | null =
    reward.userStatus === "ACTIVE"
      ? "rewards.active"
      : reward.userStatus === "OWNED"
        ? "rewards.owned"
        : reward.userStatus === "USED"
          ? "rewards.used"
          : reward.userStatus === "EXPIRED"
            ? "rewards.expired"
            : null;

  return (
    <article className={`reward-card${reward.isOwned ? " is-owned" : ""}`}>
      {/* Ảnh/emoji phần thưởng. `reward.imageUrl` có thể null — khi đó dùng
          `reward.icon` (emoji), và nếu cả hai cũng null thì chữ cái đầu tên làm
          chỗ trống thay vì ảnh vỡ. */}
      <div className="reward-card__media" aria-hidden="true">
        {reward.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reward.imageUrl} alt="" className="reward-card__img" />
        ) : reward.icon ? (
          <span className="reward-card__icon">{reward.icon}</span>
        ) : (
          <span className="reward-card__icon reward-card__icon--fallback">
            {reward.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        {reward.rarity !== "COMMON" && (
          <Badge rarity={reward.rarity as Rarity} style={{ position: "absolute", top: 8, right: 8 }}>
            {t(`rewards.rarity.${reward.rarity}` as I18nKey)}
          </Badge>
        )}
      </div>

      <div className="reward-card__body">
        <h3 className="reward-card__title">{reward.name}</h3>
        <p className="reward-card__desc">{reward.description}</p>

        <div className="reward-card__meta">
          <span className="reward-card__cost">
            <AnimatedNumber value={reward.costLXP} className="animated-number" />
            <span className="reward-card__cost-unit">LXP</span>
          </span>
          {reward.stock !== null && !outOfStock && (
            <span className="reward-card__stock">
              {t("rewards.stockLeft", { n: String(reward.stock) })}
            </span>
          )}
        </div>
      </div>

      <div className="reward-card__footer">
        {statusKey ? (
          <Badge tone={reward.userStatus === "ACTIVE" ? "green" : "neutral"}>
            {t(statusKey)}
          </Badge>
        ) : outOfStock ? (
          <span className="reward-card__hint reward-card__hint--warn">{t("rewards.outOfStock")}</span>
        ) : reward.canAfford ? (
          <span className="reward-card__hint reward-card__hint--ok">{t("rewards.affordable")}</span>
        ) : (
          // Không đủ LXP: hiện RÕ cần thêm bao nhiêu thay vì im lặng — đây là
          // phần tạo động lực ("còn 50 LXP nữa là đủ").
          <span className="reward-card__hint">
            {t("rewards.needMore", { n: String(missing) })}
          </span>
        )}

        <button
          type="button"
          className="btn-primary reward-card__cta"
          disabled={disabled}
          onClick={() => onRedeem(reward)}
        >
          {redeeming ? t("rewards.redeeming") : t("rewards.redeem")}
        </button>
      </div>
    </article>
  );
}