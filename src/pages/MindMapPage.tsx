import React, { useState, useEffect } from "react";
import { MindMap, MindMapNode, MindMapEdge } from "../types/MindMap"; // Note: using local path

import MindMapContainer from "./MindMap";
import RoadmapTaskDetail from "./RoadmapTaskDetail";
import SearchBar from "./SearchBar";
import FilterPanel from "./FilterPanel";

const MindMapPage: React.FC = () => {
  const [mindMap, setMindMap] = useState<MindMap | null>(null);
  const [tasks, setTasks] = useState<MindMapEdge[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredNodes, setFilteredNodes] = useState<MindMapNode[]>([]);

  // Simulate fetching mind map data
  useEffect(() => {
    const mockMindMap: MindMap = {
      id: "mind-001",
      userId: "user-123",
      title: "Quantum Mechanics Overview",
      description: "A comprehensive mind map of quantum mechanics concepts",
      masterYield: 85,
      roadmapReferences: ["roadmap-001", "roadmap-002"],
      sources: ["doc-chem-01", "doc-quant-02"],
      learningLoopStage: "Mind Map",
      createdAt: "2026-09-13T10:00:00Z",
      updatedAt: "2026-09-13T10:05:00Z",
    };

    const mockNodes: MindMapNode[] = [
      {
        id: "node-qm-1",
        type: "concept",
        position: { x: 150, y: 100 },
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
        id: "node-sup-1",
        type: "concept",
        position: { x: 350, y: 100 },
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
        id: "node-exam-1",
        type: "example",
        position: { x: 550, y: 100 },
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

    setMindMap(mindMap);
    setFilteredNodes(mockNodes);
  }, []);

  // Apply search filter
  const filtered = searchQuery
    ? mockNodes.filter(n => 
        n.data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.data.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : mockNodes;

  return (
    <div className="mind-map-page">
      <header className="page-header">
        <h1>Quantum Mechanics Mind Map</h1>
        <SearchBar searchQuery={searchQuery} onSearch={setSearchQuery} />
      </header>

      <main className="mind-map-main">
        <MindMapContainer mindMap={mindMap} />
        <RoadmapTaskDetail tasks={tasks} />
      </main>

      <aside className="sidebar">
        <FilterPanel tasks={tasks} searchQuery={searchQuery} />
      </aside>
    </div>
  );
};

export default MindMapPage;