import React, { useState, useMemo } from "react";
import { MindMap, MindMapNode, MindMapEdge } from "../types/MindMap";
import MindMapLayout from "./MindMapLayout";

const MindMapContainer: React.FC<{ mindMap: MindMap }> = ({ mindMap }) => {
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedEdges, setExpandedEdges] = useState<Set<string>>(new Set());

  // Simulate loading nodes from database
  useEffect(() => {
    // In a real app, this would come from an API call
    const mockNodes: MindMapNode[] = [
      {
        id: "node-1",
        type: "concept",
        position: { x: 100, y: 80 },
        data: {
          label: "Quantum Entanglement",
          title: "Quantum Entanglement",
          description: "A phenomenon where particles become interconnected...",
          summary: "Particles remain connected regardless of distance",
          keywords: ["quantum", "entanglement", "physics"],
          formula: "Φ(x,y) = ⟨ψ|Ô₁⊗Ô₂|ψ⟩",
          difficulty: 8,
          mastery: 75,
          status: "understanding",
          color: "#6366f1",
          icon: "🔗",
        },
      },
      {
        id: "node-2",
        type: "concept",
        position: { x: 200, y: 120 },
        data: {
          label: "Superposition",
          title: "Superposition",
          description: "A quantum system can exist in multiple states simultaneously",
          summary: "Fundamental principle of quantum mechanics",
          keywords: ["superposition", "quantum", "state"],
          formula: "|ψ⟩ = α|0⟩ + β|1⟩",
          difficulty: 6,
          mastery: 60,
          status: "learning",
          color: "#f59e0b",
          icon: "⚛️",
        },
      },
      {
        id: "node-3",
        type: "example",
        position: { x: 300, y: 80 },
        data: {
          label: "Schrödinger's Cat",
          title: "Schrödinger's Cat",
          description: "Thought experiment illustrating superposition",
          summary: "Cat in box until observed",
          keywords: ["thought experiment", "cat", "observation"],
          formula: "",
          difficulty: 9,
          mastery: 40,
          status: "mastered",
          color: "#10b981",
          icon: "🐱",
        },
      },
    ];
    setNodes(mockNodes);
  }, []);

  const handleNodeClick = (id: string) => {
    setSelectedNodeId(id);
  };

  const handleExpandEdge = (edgeId: string) => {
    setExpandedEdges(prev => new Set(prev).add(edgeId));
  };

  return (
    <div className="mind-map-container">
      {/* Toolbar */}
      <div className="toolbar">
        <button className="toolbar-btn" onClick={() => setSelectedNodeId(null)}>All Nodes</button>
        <button className="toolbar-btn" onClick={() => setSelectedNodeId(nodes[0]?.id || null)}>Select Node</button>
        <button className="toolbar-btn" onClick={() => setSelectedNodeId(null)}>Reset Selection</button>
      </div>

      {/* Canvas with layout */}
      <div className="mind-map-canvas">
        <MindMapLayout nodes={nodes} edges={mindMap.edges} />
      </div>

      {/* Detail Panel */}
      {selectedNodeId && (
        <div className="detail-panel">
          <h2>{nodes.find(n => n.id === selectedNodeId)?.data?.label || "Node Details"}</h2>
          <div className="detail-content">
            <p><strong>Label:</strong> {nodes.find(n => n.id === selectedNodeId)?.data?.label}</p>
            <p><strong>Description:</strong> {nodes.find(n => n.id === selectedNodeId)?.data?.description}</p>
            <p><strong>Keywords:</strong> {Array.from(nodes.find(n => n.id === selectedNodeId)?.data?.keywords || []).join(", ")}</p>
            <p><strong>Formula:</strong> {nodes.find(n => n.id === selectedNodeId)?.data?.formula || "(none)"}</p>
            <p><strong>Mastery Level:</strong> {Math.round(nodes.find(n => n.id === selectedNodeId)?.data?.mastery || 0)}%</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MindMapContainer;