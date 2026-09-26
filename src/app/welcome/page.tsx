import { Suspense } from "react";
import WelcomeExperience from "./WelcomeExperience";

export const metadata = {
  title: "Welcome to LearnX AI | Không gian học tập cá nhân hóa",
  description: "Trải nghiệm học tập cá nhân hóa được xây dựng riêng cho bạn tại LearnX AI.",
};

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "#070b16",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a0b8",
            fontFamily: "var(--font-inter), sans-serif",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "2px solid rgba(119, 117, 255, 0.2)",
                borderTopColor: "#45d9e9",
                animation: "spin 1s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <p style={{ fontSize: 14 }}>Khởi tạo không gian học tập...</p>
          </div>
        </div>
      }
    >
      <WelcomeExperience />
    </Suspense>
  );
}
