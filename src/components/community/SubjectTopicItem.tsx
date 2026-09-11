// ================================================================
// <SubjectTopicItem /> — Individual topic button in subject filter
// ================================================================

"use client";

interface SubjectTopicItemProps {
  topic: { id: string; name: string };
  isSelected: boolean;
  onClick: () => void;
}

export default function SubjectTopicItem({ topic, isSelected, onClick }: SubjectTopicItemProps) {
  return (
    <button
      key={topic.id}
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 99,
        border: isSelected ? "1px solid var(--indigo)" : "1px solid var(--border)",
        background: isSelected ? "var(--indigo-soft)" : "var(--panel-strong)",
        color: isSelected ? "var(--indigo)" : "var(--text)",
        fontSize: 12.5,
        fontWeight: isSelected ? 600 : 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "var(--indigo-soft)";
          e.currentTarget.style.borderColor = "var(--indigo)";
          e.currentTarget.style.color = "var(--indigo)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "var(--panel-strong)";
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.color = "var(--text)";
        }
      }}
    >
      {topic.name}
    </button>
  );
}