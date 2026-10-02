// ================================================================
// CLIENT API — REWARDS / ECONOMY
// ================================================================
// Mạch tư duy: gom toàn bộ lời gọi tới /api/rewards/*, /api/achievements,
// /api/daily-challenge, /api/streak vào 1 module. Lý do:
//   1. Đường dẫn + query string nằm 1 chỗ, không rải rác trong component;
//   2. Mọi lời gọi đều đi qua `readApi` nên không bao giờ lộ message kỹ thuật
//      ra UI (xem lib/api/readApi.ts);
//   3. Kiểu trả về dùng chung type trong @/types — không khai báo `any`.
//
// Backend cho sẵn, đầy đủ và an toàn (redeem chạy trong transaction + chặn
// race condition). Phần còn thiếu là UI — và đây chính là lớp UI gọi vào.
import { readApi, ApiError } from "./readApi";
import type {
  AchievementWithProgress,
  ApiResponse,
  DailyChallengeData,
  EconomyProgress,
  InventoryItem,
  RedeemResult,
  RewardHistoryData,
  RewardType,
  ShopReward,
  UnlockedAchievement,
} from "@/types";

/**
 * GET /api/rewards/shop — danh sách phần thưởng kèm trạng thái của user.
 *
 * @param type Lọc theo loại. `undefined` = lấy tất cả.
 */
export async function fetchRewardShop(type?: RewardType): Promise<ShopReward[]> {
  const url = type ? `/api/rewards/shop?type=${encodeURIComponent(type)}` : "/api/rewards/shop";
  const json: ApiResponse<ShopReward[]> = await readApi(await fetch(url), "GET /api/rewards/shop");
  if (!json.success) throw new ApiError(json.error);
  return json.data;
}

/**
 * POST /api/rewards/redeem — đổi 1 phần thưởng bằng LXP.
 *
 * Server trả về `newLXPBalance` = số dư ĐÃ TRỪ. UI dùng đúng số này để cập
 * nhật, không tự trừ tay — tránh lệch khi server chặn việc đổi trùng.
 */
export async function redeemReward(rewardId: string): Promise<RedeemResult> {
  const json: ApiResponse<RedeemResult> = await readApi(
    await fetch("/api/rewards/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rewardId }),
    }),
    "POST /api/rewards/redeem"
  );
  // Server trả 400 kèm message đã viết cho người dùng ("Không đủ LXP...",
  // "Bạn đã sở hữu phần thưởng này.") — ApiError để describeError giữ nguyên.
  if (!json.success) throw new ApiError(json.error);
  return json.data;
}

/** GET /api/rewards/inventory — các phần thưởng user đã đổi. */
export async function fetchRewardInventory(): Promise<InventoryItem[]> {
  const json: ApiResponse<InventoryItem[]> = await readApi(
    await fetch("/api/rewards/inventory"),
    "GET /api/rewards/inventory"
  );
  if (!json.success) throw new ApiError(json.error);
  return json.data;
}

/** Bộ lọc lịch sử LXP — khớp `type` mà route /api/rewards/history chấp nhận. */
export type RewardHistoryFilter = "all" | "EARNED" | "SPENT";

/** GET /api/rewards/history — lịch sử kiếm/tiêu LXP, có phân trang. */
export async function fetchRewardHistory(
  filter: RewardHistoryFilter = "all",
  page = 1,
  limit = 20
): Promise<RewardHistoryData> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filter !== "all") params.set("type", filter);
  const json: ApiResponse<RewardHistoryData> = await readApi(
    await fetch(`/api/rewards/history?${params.toString()}`),
    "GET /api/rewards/history"
  );
  if (!json.success) throw new ApiError(json.error);
  return json.data;
}

/**
 * GET /api/achievements?progress=true — toàn bộ achievement kèm trạng thái
 * mở khoá. Phải dùng `?progress=true` vì route mặc định chỉ trả achievement
 * ĐÃ mở khoá; muốn hiển thị "còn bao nhiêu để đạt" thì cần danh sách đầy đủ.
 */
export async function fetchAchievements(): Promise<AchievementWithProgress[]> {
  const json: ApiResponse<AchievementWithProgress[]> = await readApi(
    await fetch("/api/achievements?progress=true"),
    "GET /api/achievements"
  );
  if (!json.success) throw new ApiError(json.error);
  return json.data;
}

/** GET /api/achievements — các achievement đã mở khoá (kèm mốc thời gian). */
export async function fetchUnlockedAchievements(): Promise<UnlockedAchievement[]> {
  const json: ApiResponse<UnlockedAchievement[]> = await readApi(
    await fetch("/api/achievements"),
    "GET /api/achievements"
  );
  if (!json.success) throw new ApiError(json.error);
  return json.data;
}

/** GET /api/daily-challenge — thử thách hôm nay (server tự sinh nếu chưa có). */
export async function fetchDailyChallenge(): Promise<DailyChallengeData> {
  const json: ApiResponse<DailyChallengeData> = await readApi(
    await fetch("/api/daily-challenge"),
    "GET /api/daily-challenge"
  );
  if (!json.success) throw new ApiError(json.error);
  return json.data;
}

/** POST /api/daily-challenge/claim — nhận XP/LXP của thử thách đã hoàn thành. */
export async function claimDailyChallenge(): Promise<{ claimed: true }> {
  const json: ApiResponse<{ claimed: true }> = await readApi(
    await fetch("/api/daily-challenge/claim", { method: "POST" }),
    "POST /api/daily-challenge/claim"
  );
  if (!json.success) throw new ApiError(json.error);
  return json.data;
}

/** Shape của GET /api/streak (dùng bởi cả streak lẫn economy). */
export interface EconomySnapshot {
  streak: { current: number; longest: number; lastLearningDay: string | null };
  progress: EconomyProgress | null;
}

/**
 * GET /api/streak — chuỗi ngày + toàn bộ số liệu economy (lifetimeXP,
 * lxpBalance, level, levelProgress).
 *
 * Đây là nguồn SỐ DƯ LXP duy nhất cho UI. Dashboard trước đây chỉ lấy `streak`
 * từ route này; giờ dùng luôn `progress` cho card LXP để không phải gọi
 * thêm 1 endpoint (điểm #29: không request thừa).
 */
export async function fetchEconomy(): Promise<EconomySnapshot> {
  const json: ApiResponse<EconomySnapshot> = await readApi(
    await fetch("/api/streak"),
    "GET /api/streak"
  );
  if (!json.success) throw new ApiError(json.error);
  return json.data;
}