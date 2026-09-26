// Test cho state machine onboarding + quy tắc điều hướng của Welcome
// Experience. Đây là chỗ dễ sinh bug "redirect loop" nhất trong app nên
// phải khóa chặt bằng test hàm thuần thay vì test tích hợp chậm.
import { describe, expect, it } from "vitest";
import {
  hasCompletedWelcome,
  hasDecidedSurvey,
  hasUsableProfile,
  isExemptFromWelcomeRedirect,
  isLearningGatedPath,
  isOnboardingDiagnosticEntry,
  needsLearningProfile,
  nextStatusForAction,
  normalizeOnboardingStatus,
  postLoginDestination,
  profileCompletionPercent,
  type OnboardingState,
} from "../state";

const base: OnboardingState = {
  status: "NEW",
  welcomeSeenAt: null,
  firstLearningSessionAt: null,
  learningProfile: null,
  profileCompletion: 0,
  profileCompletedAt: null,
  profileComplete: false,
  hasLearningData: false,
};

describe("normalizeOnboardingStatus", () => {
  it("giữ nguyên giá trị hợp lệ", () => {
    expect(normalizeOnboardingStatus("PERSONALIZED")).toBe("PERSONALIZED");
    expect(normalizeOnboardingStatus("EXPLORING")).toBe("EXPLORING");
  });

  it("rơi về NEW khi DB có giá trị lạ (vd schema từng đổi) — không được crash", () => {
    expect(normalizeOnboardingStatus(null)).toBe("NEW");
    expect(normalizeOnboardingStatus(undefined)).toBe("NEW");
    expect(normalizeOnboardingStatus("KHONG_CO")).toBe("NEW");
  });
});

describe("hasCompletedWelcome", () => {
  it("chưa xem = chưa xong", () => {
    expect(hasCompletedWelcome({ status: "NEW", welcomeSeenAt: null })).toBe(false);
  });

  it("đã có welcomeSeenAt = đã xong kể cả khi status chưa cập nhật", () => {
    expect(hasCompletedWelcome({ status: "NEW", welcomeSeenAt: new Date() })).toBe(true);
  });

  it("EXPLORING coi là ĐÃ xong — không được ép xem lại Welcome", () => {
    // Đây là nguyên tắc cốt lõi: user đã bỏ qua Welcome thì thoát luôn,
    // không popup lại ở những lần đăng nhập sau.
    expect(hasCompletedWelcome({ status: "EXPLORING", welcomeSeenAt: null })).toBe(true);
    expect(hasCompletedWelcome({ status: "PERSONALIZED", welcomeSeenAt: null })).toBe(true);
  });
});

describe("isExemptFromWelcomeRedirect", () => {
  it("miễn cho chính /welcome và con của nó (tránh loop)", () => {
    expect(isExemptFromWelcomeRedirect("/welcome")).toBe(true);
  });

  it("miễn cho /setup — user đang setup thì không bị kéo về Welcome", () => {
    expect(isExemptFromWelcomeRedirect("/setup")).toBe(true);
  });

  it("miễn cho API (middleware không được redirect request fetch)", () => {
    expect(isExemptFromWelcomeRedirect("/api/progress")).toBe(true);
  });

  it("KHÔNG miễn cho các trang app thường", () => {
    expect(isExemptFromWelcomeRedirect("/dashboard")).toBe(false);
    expect(isExemptFromWelcomeRedirect("/mindmap")).toBe(false);
  });
});

describe("nextStatusForAction", () => {
  it("xem xong Welcome -> EXPLORING, KHÔNG phải PERSONALIZED", () => {
    // Xem Welcome không làm AI biết user; đánh dấu PERSONALIZED ở đây sẽ
    // khiến dashboard tưởng đã có profile và không gợi ý học gì nữa.
    expect(nextStatusForAction("NEW", "complete_welcome")).toBe("EXPLORING");
  });

  it("không hạ trạng thái: đang SETTING_UP mà xem lại Welcome thì giữ nguyên", () => {
    expect(nextStatusForAction("SETTING_UP", "complete_welcome")).toBe("SETTING_UP");
    expect(nextStatusForAction("PERSONALIZED", "complete_welcome")).toBe("PERSONALIZED");
  });

  it("hoàn tất setup -> PERSONALIZED", () => {
    expect(nextStatusForAction("SETTING_UP", "complete_setup")).toBe("PERSONALIZED");
  });

  it("hoàn tất phiên học đầu tiên nâng NEW lên EXPLORING", () => {
    expect(nextStatusForAction("NEW", "mark_first_session")).toBe("EXPLORING");
  });
});

describe("hasUsableProfile", () => {
  it("user mới hoàn toàn chưa có gì -> false (dùng để hiện empty state đẹp)", () => {
    expect(hasUsableProfile(base)).toBe(false);
  });

  it("có Quick Setup -> true", () => {
    expect(hasUsableProfile({ ...base, learningProfile: { version: 1, subjects: ["Toán"] } })).toBe(true);
  });

  it("chỉ có dữ liệu học thực tế cũng đủ — không bắt user điền form", () => {
    // Nguyên tắc "profile xây từ hành vi quan sát": bài làm đã nói lên rồi thì
    // đủ để AI cá nhân hoá, không cần ép user điền form.
    expect(hasUsableProfile({ ...base, hasLearningData: true })).toBe(true);
  });
});

describe("profileCompletionPercent", () => {
  it("chưa có gì -> 0", () => {
    expect(profileCompletionPercent(base)).toBe(0);
  });

  it("hồ sơ Quick Setup cũ (chỉ có môn) vẫn tính được điểm", () => {
    // TƯƠNG THÍCH NGƯỢC: dữ liệu người dùng cũ chỉ có subjects/level, không
    // có field onboarding mới — không được làm % tụt về 0.
    expect(profileCompletionPercent({ learningProfile: { version: 1, subjects: ["Toán"] } })).toBe(20);
  });

  it("không bao giờ vượt 100 khi điền đủ", () => {
    expect(
      profileCompletionPercent({
        learningProfile: {
          version: 1,
          educationStage: "THPT",
          intents: ["SCORE"],
          goalCategory: "EXAM",
          subjects: ["Toán"],
          careerStatus: "UNDECIDED",
          studyTime: "1_2_HOURS",
          aiPreferences: ["NO_DIRECT_ANSWER"],
          learningPreferences: ["MIXED"],
        },
      })
    ).toBe(100);
  });
});

describe("postLoginDestination", () => {
  it("user mới -> /welcome", () => {
    expect(postLoginDestination(base)).toBe("/welcome");
  });

  it("returning user -> /dashboard thẳng, không delay", () => {
    expect(postLoginDestination({ status: "EXPLORING", welcomeSeenAt: null })).toBe("/dashboard");
    expect(postLoginDestination({ status: "PERSONALIZED", welcomeSeenAt: new Date() })).toBe("/dashboard");
  });
});

// ---- GATE MỀM (khảo sát học tập) ----
// Rất quan trọng: đây là quy tắc quyết định ai bị nhắc/được chặn. Test ở đây
// khóa lại cam kết "Dashboard KHÔNG bao giờ bị chặn" — nếu sau này ai đó thêm
// /dashboard vào danh sách gate, test này đỏ ngay.
describe("hasDecidedSurvey", () => {
  it("chưa có mốc -> chưa chốt", () => {
    expect(hasDecidedSurvey(null)).toBe(false);
    // Profile đầy đủ nhưng CHƯA chốt (đang làm dở) -> vẫn phải nhắc.
    expect(hasDecidedSurvey({ educationStage: "THPT" })).toBe(false);
  });

  it("đã chốt (hoàn tất HOẶC bỏ qua) -> đã chốt", () => {
    expect(hasDecidedSurvey({ surveyDecidedAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
  });
});

describe("needsLearningProfile", () => {
  const seen = { status: "EXPLORING" as const, welcomeSeenAt: new Date() };

  it("user mới chưa xem Welcome -> chưa tới lượt khảo sát", () => {
    expect(needsLearningProfile({ status: "NEW", welcomeSeenAt: null })).toBe(false);
  });

  it("đã xem Welcome, chưa chốt, hồ sơ rỗng -> cần nhắc", () => {
    expect(needsLearningProfile({ ...seen, learningProfile: null })).toBe(true);
  });

  it("đã bấm bỏ qua -> KHÔNG nhắc nữa", () => {
    expect(
      needsLearningProfile({
        ...seen,
        learningProfile: { version: 1, surveyDecidedAt: "2026-01-01T00:00:00.000Z" },
      })
    ).toBe(false);
  });

  it("có dữ liệu học thật -> coi như AI đã biết qua hành vi", () => {
    expect(needsLearningProfile({ ...seen, learningProfile: null, hasLearningData: true })).toBe(false);
  });

  it("hồ sơ đã đủ (>= 80%) -> không nhắc", () => {
    expect(needsLearningProfile({ ...seen, learningProfile: null, profileCompletion: 85 })).toBe(false);
  });
});

describe("isLearningGatedPath", () => {
  it("gate các trang học chính (kể cả trang con)", () => {
    for (const p of ["/roadmap", "/diagnostic", "/practice", "/library", "/roadmap/abc"]) {
      expect(isLearningGatedPath(p)).toBe(true);
    }
  });

  it("KHÔNG gate Dashboard và các trang khác (cam kết: app luôn mở được)", () => {
    for (const p of ["/dashboard", "/tutor", "/settings", "/onboarding", "/welcome"]) {
      expect(isLearningGatedPath(p)).toBe(false);
    }
  });

  it("/onboarding phải nằm trong danh sách miễn để không redirect loop", () => {
    expect(isExemptFromWelcomeRedirect("/onboarding")).toBe(true);
  });
});

// Khóa lại root cause của lỗi "nút Bắt đầu kiểm tra bấm không phản hồi":
// /diagnostic nằm trong LEARNING_GATE_PATHS, mà ở bước "Kiểm tra năng lực"
// của khảo sát thì `surveyDecidedAt` CHƯA ghi -> proxy kéo thẳng về
// /onboarding, tức chính trang user đang đứng -> không có gì xảy ra.
// Nếu ai đó xoá miễn trừ này, test dưới đỏ ngay.
describe("isOnboardingDiagnosticEntry", () => {
  it("lối vào có gắn cờ từ khảo sát -> miễn gate", () => {
    const params = new URLSearchParams("from=onboarding");
    expect(isOnboardingDiagnosticEntry("/diagnostic", params)).toBe(true);
    // Chấp nhận cả dạng string -> proxy truyền xuống dạng nào cũng đúng.
    expect(isOnboardingDiagnosticEntry("/diagnostic", "from=onboarding")).toBe(true);
  });

  it("vào TRỰC TIẾP /diagnostic (sidebar, deep link) -> vẫn bị gate", () => {
    expect(isOnboardingDiagnosticEntry("/diagnostic", new URLSearchParams())).toBe(false);
    expect(isOnboardingDiagnosticEntry("/diagnostic", null)).toBe(false);
    // Cờ sai giá trị -> không được lách.
    expect(isOnboardingDiagnosticEntry("/diagnostic", new URLSearchParams("from=elsewhere"))).toBe(
      false
    );
  });

  it("KHÔNG nới gate cho trang học khác dù có cùng cờ", () => {
    // Nếu chỉ cần đúng /diagnostic thì bỏ "from=onboarding" khỏi URL
    // /roadmap vẫn phải bị nhắc khảo sát.
    for (const p of ["/roadmap", "/practice", "/library", "/dashboard"]) {
      expect(isOnboardingDiagnosticEntry(p, new URLSearchParams("from=onboarding"))).toBe(false);
    }
  });
});
