// ================================================================
// TRANG CHI TIẾT TÀI LIỆU CỘNG ĐỒNG
// ================================================================

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import CommunityDocumentDetail from "@/components/community/DocumentDetail";
import type { CommunityDocumentWithRelations } from "@/types";



const REPORT_REASONS = [
  { value: "WRONG_INFO", label: "Sai thông tin" },
  { value: "SPAM", label: "Spam" },
  { value: "DUPLICATE", label: "Trùng lặp" },
  { value: "MISLEADING", label: "Gây hiểu lầm" },
  { value: "INAPPROPRIATE", label: "Nội dung không phù hợp" },
  { value: "COPYRIGHT", label: "Vi phạm bản quyền" },
  { value: "WRONG_SUBJECT", label: "Sai môn học/chủ đề" },
  { value: "OTHER", label: "Khác" },
];

const TRUST_LABELS: Record<string, string> = {
  HIGH_QUALITY: "Chất lượng cao",
  COMMUNITY_VERIFIED: "Đã xác minh",
  NEW: "Mới",
  NEEDS_REVIEW: "Cần xem xét",
  LOW_QUALITY: "Chất lượng thấp",
};

const TRUST_COLORS: Record<string, string> = {
  HIGH_QUALITY: "var(--cyan)",
  COMMUNITY_VERIFIED: "var(--indigo)",
  NEW: "var(--amber)",
  NEEDS_REVIEW: "var(--rose)",
  LOW_QUALITY: "var(--text-dim)",
};

export default function DocumentDetailPage() {
  const router = useRouter();
  const routeParams = useParams();
  const documentId = routeParams.id as string;
  const [document, setDocument] = useState<CommunityDocumentWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  async function loadDocument() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/community/documents/${documentId}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Không tìm thấy tài liệu");
        return;
      }
      const doc = json.data;
      if (doc.visibility !== "COMMUNITY" && doc.ownerId !== await getCurrentUserId()) {
        setError("Không có quyền truy cập tài liệu này");
        return;
      }
      setDocument(doc);
      setUserRating(doc.userRating ?? null);
      setSaved(doc.userSave ?? false);
    } catch (err) {
      setError("Không thể tải tài liệu");
    } finally {
      setLoading(false);
    }
  }

  async function getCurrentUserId(): Promise<string | null> {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      return data?.user?.id || null;
    } catch {
      return null;
    }
  }

  const handleRate = async (rating: number) => {
    if (!document) return;
    setRatingLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        alert("Vui lòng đăng nhập để đánh giá");
        return;
      }
      const res = await fetch(`/api/community/documents/${document.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      const json = await res.json();
      if (json.success) {
        setUserRating(rating);
        setDocument(prev => prev ? { 
          ...prev, 
          averageRating: json.data.averageRating, 
          ratingCount: json.data.ratingCount, 
          userRating: rating 
        } : null);
      } else {
        alert("Không thể đánh giá: " + json.error);
      }
    } catch (err) {
      alert("Không thể đánh giá: " + (err instanceof Error ? err.message : "Lỗi không xác định"));
    } finally {
      setRatingLoading(false);
    }
  };

  const handleSave = async () => {
    if (!document) return;
    setSaving(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        alert("Vui lòng đăng nhập để lưu tài liệu");
        return;
      }
      const res = await fetch(`/api/community/documents/${document.id}/save`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setSaved(json.data.saved);
        setDocument(prev => prev ? { 
          ...prev, 
          saveCount: json.data.saved ? (prev.saveCount || 0) + 1 : (prev.saveCount || 0) - 1, 
          userSave: json.data.saved 
        } : null);
      } else {
        alert("Không thể lưu/bỏ lưu: " + json.error);
      }
    } catch (err) {
      alert("Không thể lưu/bỏ lưu: " + (err instanceof Error ? err.message : "Lỗi không xác định"));
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        alert("Vui lòng đăng nhập để tải tài liệu");
        return;
      }
      await fetch(`/api/community/documents/${document.id}/download`, {
        method: "POST",
      });
      window.open(`/api/community/documents/${document.id}/download`, "_blank");
    } catch (err) {
      alert("Không thể tải tài liệu: " + (err instanceof Error ? err.message : "Lỗi không xác định"));
    }
  };

  const handleReport = async () => {
    if (!reportReason) return;
    setReporting(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        alert("Vui lòng đăng nhập để báo cáo");
        return;
      }
      const res = await fetch(`/api/community/documents/${document?.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason, description: reportDescription }),
      });
      const json = await res.json();
      if (json.success) {
        alert("Đã gửi báo cáo. Cảm ơn bạn đã giúp cải thiện chất lượng cộng đồng!");
        setShowReportModal(false);
        setReportReason("");
        setReportDescription("");
      } else {
        alert("Không thể báo cáo: " + json.error);
      }
    } catch (err) {
      alert("Không thể báo cáo: " + (err instanceof Error ? err.message : "Lỗi không xác định"));
    } finally {
      setReporting(false);
    }
  };

  if (loading) return <StateMessage kind="loading" text="Đang tải tài liệu..." />;
  if (error) return <StateMessage kind="error" text={error} />;
  if (!document) return null;

  return (
    <CommunityDocumentDetail
      document={document}
      onClose={() => router.push("/community")}
      onRate={handleRate}
      onSave={handleSave}
      onDownload={handleDownload}
      onReport={handleReport}
      userRating={userRating ?? undefined}
      saved={saved}
    />
  );
}

function formatNumber(num: number) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}