import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Song, SongRelationship, storage } from '@/lib/storage';

interface GraphNode {
  id: string;
  song: Song;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isCenter: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: SongRelationship;
}

interface SongRelationshipGraphProps {
  centerSong: Song;
  relationships: {
    asSource: Array<SongRelationship & { targetSong: Song }>;
    asTarget: Array<SongRelationship & { sourceSong: Song }>;
  };
  onNavigateToSong?: (song: Song) => void;
}

const relationshipColors: Record<string, string> = {
  remix: '#a855f7',      // Purple
  cover: '#3b82f6',      // Blue
  mashup: '#ec4899',     // Pink
  edit: '#22c55e',       // Green
  bootleg: '#f97316',    // Orange
  same_sample: '#eab308', // Yellow
};

const relationshipLabels: Record<string, string> = {
  remix: 'Remix',
  cover: 'Cover',
  mashup: 'Mashup',
  edit: 'Edit',
  bootleg: 'Bootleg',
  same_sample: 'Same Sample',
};

// Canvas-compatible colors (not CSS variables)
const COLORS = {
  centerNode: '#404040',        // Neutral gray for center
  centerNodeBorder: '#666666',
  relatedNode: '#1e293b',       // Slate dark
  relatedNodeBorder: '#475569',
  hoveredNode: '#334155',
  hoveredNodeBorder: '#f97316', // Orange accent
  background: 'rgba(15, 15, 15, 0.9)',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textPrimary: '#f97316',       // Orange accent
};

export function SongRelationshipGraph({ centerSong, relationships, onNavigateToSong }: SongRelationshipGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [draggingNode, setDraggingNode] = useState<GraphNode | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);

  // Build graph data from relationships
  useEffect(() => {
    const nodeMap = new Map<string, GraphNode>();
    const edgeList: GraphEdge[] = [];

    // Add center node
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    
    nodeMap.set(centerSong.id, {
      id: centerSong.id,
      song: centerSong,
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      isCenter: true,
    });

    // Add related nodes from source relationships
    relationships.asSource.forEach((rel) => {
      if (rel.targetSong && !nodeMap.has(rel.targetSong.id)) {
        nodeMap.set(rel.targetSong.id, {
          id: rel.targetSong.id,
          song: rel.targetSong,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          isCenter: false,
        });
      }
      edgeList.push({
        source: centerSong.id,
        target: rel.target_song_id,
        relationship: rel,
      });
    });

    // Add related nodes from target relationships
    relationships.asTarget.forEach((rel) => {
      if (rel.sourceSong && !nodeMap.has(rel.sourceSong.id)) {
        nodeMap.set(rel.sourceSong.id, {
          id: rel.sourceSong.id,
          song: rel.sourceSong,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          isCenter: false,
        });
      }
      edgeList.push({
        source: rel.source_song_id,
        target: centerSong.id,
        relationship: rel,
      });
    });

    // Position related nodes in a circle around center
    const radius = Math.min(dimensions.width, dimensions.height) * 0.32;
    const relatedNodes = Array.from(nodeMap.values()).filter(n => !n.isCenter);
    const angleStep = (2 * Math.PI) / Math.max(relatedNodes.length, 1);
    
    relatedNodes.forEach((node, index) => {
      const angle = angleStep * index - Math.PI / 2;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    });

    setNodes(Array.from(nodeMap.values()));
    setEdges(edgeList);
  }, [centerSong, relationships, dimensions]);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: Math.max(400, width), height: Math.max(300, height) });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Simple force simulation
  useEffect(() => {
    if (nodes.length <= 1) return;

    const simulate = () => {
      const updatedNodes = [...nodes];
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const targetRadius = Math.min(dimensions.width, dimensions.height) * 0.32;

      updatedNodes.forEach((node) => {
        if (node.isCenter || draggingNode?.id === node.id) return;

        // Spring force toward ideal position
        const dx = node.x - centerX;
        const dy = node.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
          const force = (dist - targetRadius) * 0.02;
          node.vx -= (dx / dist) * force;
          node.vy -= (dy / dist) * force;
        }

        // Repulsion from other non-center nodes
        updatedNodes.forEach((other) => {
          if (other.id === node.id || other.isCenter) return;
          const odx = node.x - other.x;
          const ody = node.y - other.y;
          const oDist = Math.sqrt(odx * odx + ody * ody);
          if (oDist < 120 && oDist > 0) {
            const repulsion = (120 - oDist) * 0.01;
            node.vx += (odx / oDist) * repulsion;
            node.vy += (ody / oDist) * repulsion;
          }
        });

        // Apply velocity with damping
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.9;
        node.vy *= 0.9;

        // Keep in bounds (with more margin for labels)
        node.x = Math.max(80, Math.min(dimensions.width - 80, node.x));
        node.y = Math.max(50, Math.min(dimensions.height - 50, node.y));
      });

      setNodes(updatedNodes);
      animationRef.current = requestAnimationFrame(simulate);
    };

    animationRef.current = requestAnimationFrame(simulate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [nodes.length, dimensions, draggingNode]);

  // Draw the graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Draw subtle grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < dimensions.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, dimensions.height);
      ctx.stroke();
    }
    for (let y = 0; y < dimensions.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(dimensions.width, y);
      ctx.stroke();
    }

    // Draw edges with glow effect
    edges.forEach((edge) => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return;

      const color = relationshipColors[edge.relationship.relationship_type] || '#888888';
      
      // Glow effect
      ctx.beginPath();
      ctx.moveTo(sourceNode.x, sourceNode.y);
      ctx.lineTo(targetNode.x, targetNode.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.15;
      ctx.stroke();
      ctx.globalAlpha = 1;
      
      // Main line
      ctx.beginPath();
      ctx.moveTo(sourceNode.x, sourceNode.y);
      ctx.lineTo(targetNode.x, targetNode.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw arrow
      const angle = Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x);
      const arrowSize = 10;
      const arrowX = (sourceNode.x + targetNode.x) / 2;
      const arrowY = (sourceNode.y + targetNode.y) / 2;

      ctx.beginPath();
      ctx.moveTo(arrowX + arrowSize * Math.cos(angle), arrowY + arrowSize * Math.sin(angle));
      ctx.lineTo(
        arrowX - arrowSize * Math.cos(angle - Math.PI / 5),
        arrowY - arrowSize * Math.sin(angle - Math.PI / 5)
      );
      ctx.lineTo(
        arrowX - arrowSize * Math.cos(angle + Math.PI / 5),
        arrowY - arrowSize * Math.sin(angle + Math.PI / 5)
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Draw relationship label on edge with background
      const label = relationshipLabels[edge.relationship.relationship_type] || edge.relationship.relationship_type;
      const labelX = arrowX;
      const labelY = arrowY - 16;
      
      ctx.font = 'bold 10px system-ui';
      const labelWidth = ctx.measureText(label).width + 8;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(labelX - labelWidth / 2, labelY - 8, labelWidth, 16, 4);
      ctx.fill();
      
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, labelX, labelY);
    });

    // Draw nodes
    nodes.forEach((node) => {
      const isHovered = hoveredNode?.id === node.id;
      const nodeRadius = node.isCenter ? 32 : 26;
      
      // Glow effect for hovered nodes
      if (isHovered && !node.isCenter) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 8, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(node.x, node.y, nodeRadius, node.x, node.y, nodeRadius + 12);
        gradient.addColorStop(0, 'rgba(249, 115, 22, 0.4)');
        gradient.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      
      // Node fill with gradient
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
      
      if (node.isCenter) {
        // Neutral gradient for center node
        const gradient = ctx.createRadialGradient(node.x - 8, node.y - 8, 0, node.x, node.y, nodeRadius);
        gradient.addColorStop(0, '#555555');
        gradient.addColorStop(1, '#2a2a2a');
        ctx.fillStyle = gradient;
      } else {
        // Colored gradient for related nodes
        const gradient = ctx.createRadialGradient(node.x - 6, node.y - 6, 0, node.x, node.y, nodeRadius);
        gradient.addColorStop(0, isHovered ? '#475569' : '#334155');
        gradient.addColorStop(1, isHovered ? '#1e293b' : '#0f172a');
        ctx.fillStyle = gradient;
      }
      ctx.fill();
      
      // Node border
      ctx.strokeStyle = node.isCenter 
        ? '#777777'
        : isHovered 
          ? COLORS.hoveredNodeBorder
          : '#475569';
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.stroke();

      // Music note icon (simplified)
      ctx.beginPath();
      ctx.arc(node.x, node.y - 2, 5, 0, Math.PI * 2);
      ctx.fillStyle = node.isCenter ? '#999999' : (isHovered ? COLORS.textPrimary : '#64748b');
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(node.x + 5, node.y - 2);
      ctx.lineTo(node.x + 5, node.y - 12);
      ctx.strokeStyle = node.isCenter ? '#999999' : (isHovered ? COLORS.textPrimary : '#64748b');
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw labels below nodes
    nodes.forEach((node) => {
      const isHovered = hoveredNode?.id === node.id;
      const nodeRadius = node.isCenter ? 32 : 26;
      const labelY = node.y + nodeRadius + 16;

      // Measure text for background
      ctx.font = node.isCenter ? 'bold 12px system-ui' : '11px system-ui';
      const titleWidth = ctx.measureText(node.song.title).width;
      ctx.font = '10px system-ui';
      const artistWidth = ctx.measureText(node.song.artist).width;
      const bgWidth = Math.max(titleWidth, artistWidth) + 16;
      const bgHeight = 34;

      // Label background with rounded corners
      ctx.fillStyle = COLORS.background;
      ctx.beginPath();
      ctx.roundRect(node.x - bgWidth / 2, labelY - 14, bgWidth, bgHeight, 6);
      ctx.fill();
      
      // Border for label
      ctx.strokeStyle = node.isCenter ? '#555555' : (isHovered ? COLORS.hoveredNodeBorder : '#333333');
      ctx.lineWidth = 1;
      ctx.stroke();

      // Title text
      ctx.font = node.isCenter ? 'bold 12px system-ui' : '11px system-ui';
      ctx.fillStyle = node.isCenter 
        ? '#ffffff'
        : isHovered 
          ? COLORS.textPrimary 
          : COLORS.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.song.title, node.x, labelY);
      
      // Artist text
      ctx.font = '10px system-ui';
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText(node.song.artist, node.x, labelY + 14);
    });
  }, [nodes, edges, hoveredNode, dimensions]);

  // Mouse interaction handlers
  const getNodeAtPosition = useCallback((x: number, y: number): GraphNode | null => {
    // Check nodes in reverse order (top nodes first)
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = x - node.x;
      const dy = y - node.y;
      const radius = node.isCenter ? 28 : 22;
      if (dx * dx + dy * dy <= radius * radius) {
        return node;
      }
    }
    return null;
  }, [nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggingNode) {
      setNodes(prev => prev.map(node => 
        node.id === draggingNode.id 
          ? { ...node, x, y, vx: 0, vy: 0 }
          : node
      ));
    } else {
      const node = getNodeAtPosition(x, y);
      setHoveredNode(node);
      canvas.style.cursor = node && !node.isCenter ? 'pointer' : 'default';
    }
  }, [draggingNode, getNodeAtPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const node = getNodeAtPosition(x, y);
    if (node && !node.isCenter) {
      setDraggingNode(node);
      setDragStartPos({ x, y });
    }
  }, [getNodeAtPosition]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if it was a click (not a drag)
    if (draggingNode && dragStartPos) {
      const dx = x - dragStartPos.x;
      const dy = y - dragStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If moved less than 5px, treat as click
      if (distance < 5 && onNavigateToSong) {
        onNavigateToSong(draggingNode.song);
      }
    }
    
    setDraggingNode(null);
    setDragStartPos(null);
  }, [draggingNode, dragStartPos, onNavigateToSong]);

  const handleMouseLeave = useCallback(() => {
    setDraggingNode(null);
    setDragStartPos(null);
    setHoveredNode(null);
  }, []);

  const hasRelationships = relationships.asSource.length > 0 || relationships.asTarget.length > 0;

  if (!hasRelationships) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No relationships to display as a graph.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-96 relative">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full rounded-lg"
      />
      
      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex flex-wrap gap-2 bg-background/80 backdrop-blur-sm rounded-md p-2 text-xs">
        {Object.entries(relationshipLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: relationshipColors[key] }}
            />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Click hint */}
      <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm rounded-md px-2 py-1">
        Click a node to explore its relationships
      </div>
    </div>
  );
}

