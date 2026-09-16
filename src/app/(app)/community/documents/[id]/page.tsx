// ================================================================
// TRANG CHI TIẾT TÀI LIỆU CỘNG ĐỒNG
// ================================================================

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import CommunityDocumentDetail from "@/components/community/DocumentDetail";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { CommunityDocumentWithRelations } from "@/types";

export default function DocumentDetailPage() {
  const { t } = useLanguage();
  const { push } = useToast();
  const router = useRouter();
  const routeParams = useParams();
  const documentId = typeof routeParams?.id === "string" ? routeParams.id : "";
  const [document, setDocument] = useState<CommunityDocumentWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
        setError(json.error || t("com.doc.notFound"));
        return;
      }
      const doc = json.data;
      if (doc.visibility !== "COMMUNITY" && doc.ownerId !== await getCurrentUserId()) {
        setError(t("com.doc.noAccess"));
        return;
      }
      setDocument(doc);
      setUserRating(doc.userRating ?? null);
      setSaved(doc.userSave ?? false);
    } catch (err) {
      setError(t("com.doc.loadFail"));
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
        push("error", t("com.doc.loginRate"));
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
        push("error", t("com.doc.rateFail") + json.error);
      }
    } catch (err) {
      push("error", t("com.doc.rateUnknown"));
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
        push("error", t("com.doc.loginSave"));
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
        push("error", t("com.doc.saveFail") + json.error);
      }
    } catch (err) {
      push("error", t("com.doc.saveUnknown"));
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        push("error", t("com.doc.loginDownload"));
        return;
      }
      await fetch(`/api/community/documents/${document.id}/download`, {
        method: "POST",
      });
      window.open(`/api/community/documents/${document.id}/download`, "_blank");
    } catch (err) {
      push("error", t("com.doc.downloadUnknown"));
    }
  };

  // Dùng đúng reason/description modal trả về (trước đây bỏ qua args,
  // đọc state chết luôn rỗng nên báo cáo không bao giờ gửi được).
  const handleReport = async (reason: string, description: string) => {
    if (!reason || !document) return;
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        push("error", t("com.doc.loginReport"));
        return;
      }
      const res = await fetch(`/api/community/documents/${document.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, description }),
      });
      const json = await res.json();
      if (json.success) {
        push("success", t("com.doc.reportThanks"));
      } else {
        push("error", t("com.doc.reportFail") + json.error);
      }
    } catch (err) {
      push("error", t("com.doc.reportUnknown"));
    }
  };

  if (loading) return <StateMessage kind="loading" text={t("com.doc.loading")} />;
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
