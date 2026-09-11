// ================================================================
// <SubjectFilter /> — Filter component for community documents
// ================================================================

"use client";

import { useState, useEffect } from "react";
import type { SubjectWithTopics } from "@/types";
import SubjectTopicItem from "@/components/community/SubjectTopicItem";

interface SubjectFilterProps {
  subjects: SubjectWithTopics[];
  selectedSubjectId?: string;
  selectedTopicId?: string;
  onSubjectChange: (subjectId: string) => void;
  onTopicChange: (topicId: string) => void;
  onClear: () => void;
}

function SubjectFilter({
  subjects,
  selectedSubjectId,
  selectedTopicId,
  onSubjectChange,
  onTopicChange,
  onClear,
}: SubjectFilterProps) {
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedSubjectId && selectedSubjectId !== expandedSubjectId) {
      setExpandedSubjectId(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  const handleSubjectClick = (subjectId: string) => {
    if (expandedSubjectId === subjectId) {
      setExpandedSubjectId(null);
      onSubjectChange("");
    } else {
      setExpandedSubjectId(subjectId);
      onSubjectChange(subjectId);
    }
  };

  const hasSelection = selectedSubjectId || selectedTopicId;

  return (
    <div style={{ border: "1px solid var(--border-soft)", borderRadius: 12, background: "var(--panel)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>📚</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Môn học & Chủ đề</span>
        </div>
        {hasSelection && (
          <button
            onClick={onClear}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--panel-strong)",
              color: "var(--text-dim)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--rose-soft)"; e.currentTarget.style.borderColor = "var(--rose)"; e.currentTarget.style.color = "var(--rose)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--panel-strong)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            ✕ Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Subject List */}
      <div style={{ maxHeight: 400, overflowY: "auto" }}>
        {subjects.map((subject) => {
          const isSelected = selectedSubjectId === subject.id;
          const isExpanded = expandedSubjectId === subject.id;
          const hasTopics = subject.topics && subject.topics.length > 0;

          return (
            <div key={subject.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
              <button
                onClick={() => handleSubjectClick(subject.id)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  textAlign: "left",
                  background: isSelected ? "var(--indigo-soft)" : "transparent",
                  border: "none",
                  color: isSelected ? "var(--indigo)" : "var(--text)",
                  fontSize: 14,
                  fontWeight: isSelected ? 600 : 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "var(--panel-strong)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontSize: 18 }}>{subject.icon || "📚"}</span>
                <span style={{ flex: 1 }}>{subject.name}</span>
                {hasTopics && (
                  <span style={{
                    transition: "transform 0.15s ease",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                  }}>
                    ▼
                  </span>
                )}
                {isSelected && (
                  <span style={{
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 99,
                    background: "var(--indigo)",
                    color: "#0a0e16",
                    fontWeight: 700,
                  }}>
                    Đã chọn
                  </span>
                )}
              </button>
              {isExpanded && hasTopics && (
                <div style={{ padding: "8px 16px 12px", borderTop: "1px solid var(--border-soft)", background: "var(--bg)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {subject.topics!.map((topic) => (
                      <SubjectTopicItem
                        key={topic.id}
                        topic={topic}
                        isSelected={selectedTopicId === topic.id}
                        onClick={() => onTopicChange(selectedTopicId === topic.id ? "" : topic.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SubjectFilter;