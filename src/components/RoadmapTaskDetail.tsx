import React, { useState } from "react";
import { MindMapEdge } from "../types/MindMap";

interface RoadmapTaskDetailProps {
  edges: MindMapEdge[];
  onClose: () => void;
}

const RoadmapTaskDetail: React.FC<RoadmapTaskDetailProps> = ({ edges, onClose }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const handleToggle = (edgeId: string) => {
    setExpanded(prev => new Set(prev).add(edgeId));
  };

  return (
    <div className="roadmap-task-detail">
      <button className="task-close" onClick={onClose}>✕ Close</button>
      <div className="task-list">
        {edges.map(edge => (
          <div
            key={edge.id}
            className={`edge-item ${expanded.has(edge.id) ? "expanded" : ""}`}
            onClick={() => handleToggle(edge.id)}
          >
            <div className="edge-source">{edge.source}</div>
            <div className="edge-target">{edge.target}</div>
            <span className="edge-type">{edge.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoadmapTaskDetail;