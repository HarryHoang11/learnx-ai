import type { Prisma } from "@prisma/client";

export interface MindMapNode {
  id: string;
  label: string;
  parentId: string | null;
  type?: string;
  description?: string;
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
}

export interface MindMapData {
  version?: number;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

export function toMindMapJson(data: MindMapData): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonObject;
}

const MAX_NODES = 500;
const MAX_EDGES = 1_000;

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

export function parseMindMapData(value: unknown): MindMapData | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as { version?: unknown; nodes?: unknown; edges?: unknown };
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) return null;
  if (input.nodes.length > MAX_NODES || input.edges.length > MAX_EDGES) return null;

  const nodeIds = new Set<string>();
  const nodes: MindMapNode[] = [];
  for (const rawNode of input.nodes) {
    if (typeof rawNode !== "object" || rawNode === null) return null;
    const node = rawNode as { id?: unknown; label?: unknown; parentId?: unknown; type?: unknown; description?: unknown };
    const id = boundedString(node.id, 200);
    const label = boundedString(node.label, 500);
    if (!id || !label || nodeIds.has(id)) return null;
    if (node.parentId !== null && node.parentId !== undefined && typeof node.parentId !== "string") return null;
    const type = node.type === undefined ? undefined : boundedString(node.type, 50);
    const description = node.description === undefined ? undefined : boundedString(node.description, 2_000) ?? undefined;
    nodeIds.add(id);
    nodes.push({
      id,
      label,
      parentId: typeof node.parentId === "string" ? node.parentId : null,
      ...(type ? { type } : {}),
      ...(description ? { description } : {}),
    });
  }

  const edges: MindMapEdge[] = [];
  const edgeIds = new Set<string>();
  for (const rawEdge of input.edges) {
    if (typeof rawEdge !== "object" || rawEdge === null) return null;
    const edge = rawEdge as { id?: unknown; source?: unknown; target?: unknown };
    const id = boundedString(edge.id, 200);
    const source = boundedString(edge.source, 200);
    const target = boundedString(edge.target, 200);
    if (!id || !source || !target || edgeIds.has(id) || !nodeIds.has(source) || !nodeIds.has(target)) return null;
    edgeIds.add(id);
    edges.push({ id, source, target });
  }

  const parentById = new Map(nodes.map((node) => [node.id, node.parentId]));
  for (const node of nodes) {
    if (node.parentId !== null && !nodeIds.has(node.parentId)) return null;
    const visited = new Set<string>();
    let current: string | null = node.id;
    while (current !== null) {
      if (visited.has(current)) return null;
      visited.add(current);
      current = parentById.get(current) ?? null;
    }
  }

  return {
    ...(typeof input.version === "number" && Number.isInteger(input.version) ? { version: input.version } : {}),
    nodes,
    edges,
  };
}
