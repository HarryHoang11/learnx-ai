// Mind Map type definitions for the learning loop
// Supporting interfaces for the enhanced MindMap structure

export interface MindMap {
  id: string;
  userId: string;
  documentId?: string;
  title: string;
  description?: string;
  masterYield: number; // 0-100%, from SkillProfile (mastery level)
  roadmapReferences: string[]; // IDs of roadmap tasks this mind map connects to
  sources: string[]; // IDs of source documents/chunks this mind map is derived from
  learningLoopStage: "Document" | "Summary" | "Mind Map" | "Diagnostic" | "Skill Profile" | "Roadmap" | "Tutor" | "Practice" | "Review";
  createdAt: string;
  updatedAt: string;
}

export interface MindMapNode {
  id: string;
  type: string; // e.g., "concept", "example", "formula", "question"
  position: {
    x: number;
    y: number;
  };
  data: {
    label: string;
    title?: string;
    description?: string;
    summary?: string;
    keywords?: string[];
    examples?: string[];
    formula?: string;
    difficulty?: number;
    mastery?: number;
    status?: string;
    color?: string;
    icon?: string;
    sourceChunkIds?: string[];
    linkedRoadmapItemId?: string;
    linkedTopicId?: string;
  };
  style?: Record<string, string>;
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  animated?: boolean;
  data?: Record<string, any>;
}