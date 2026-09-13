import React, { useState, useMemo } from "react";
import { MindMap, MindMapNode, MindMapEdge } from "../types/MindMap";

interface MindMapLayout {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  containerWidth: number;
  containerHeight: number;
}

const MindMapLayout: React.FC<{ nodes: MindMapNode[], edges: MindMapEdge[] }> = ({ nodes, edges }) => {
  const containerWidth = 1200;
  const containerHeight = 800;
  
  // Calculate optimal positions for nodes using simple grid-based layout
  const calculatePositions = useMemo(() => {
    if (nodes.length === 0) return [];
    
    const numNodes = nodes.length;
    const cols = Math.min(Math.ceil(Math.sqrt(numNodes)), 20);
    const row = Math.floor(numNodes / cols);
    
    return nodes.map((node, index) => {
      const col = index % cols;
      const row = index / cols;
      const x = (col - (cols - 1) / 2) * 150 + 50;
      const y = (row - (row + 1) / 2) * 150 + 50;
      return { ...node, position: { x, y } };
    });
  }, [nodes]);
  
  // Group edges by source node for efficient rendering
  const groupedEdges = useMemo(() => {
    const groups: Record<string, MindMapEdge[]> = {};
    edges.forEach(edge => {
      if (!groups[edge.source]) groups[edge.source] = [];
      groups[edge.source].push(edge);
    });
    return groups;
  }, [edges]);
  
  return (
    <div className="mind-map-layout">
      {groupedEdges.filter(g => g.length > 0).map(group => (
        <div key={group} className="layout-grid">
          {group.map(edge => (
            <div key={edge.id} className="edge-group">
              <span className="edge-source-label">{edge.source}</span>
              {group.map(edge => (
                <div key={edge.id} className="edge-item">
                  <span className="edge-target-label">{edge.target}</span>
                  <span className="edge-type-label">{edge.type}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default MindMapLayout;