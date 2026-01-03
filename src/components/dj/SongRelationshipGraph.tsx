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
  remix: 'hsl(280, 70%, 60%)',
  cover: 'hsl(200, 70%, 60%)',
  mashup: 'hsl(320, 70%, 60%)',
  edit: 'hsl(160, 70%, 60%)',
  bootleg: 'hsl(30, 70%, 60%)',
  same_sample: 'hsl(50, 70%, 60%)',
};

const relationshipLabels: Record<string, string> = {
  remix: 'Remix',
  cover: 'Cover',
  mashup: 'Mashup',
  edit: 'Edit',
  bootleg: 'Bootleg',
  same_sample: 'Same Sample',
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

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw edges
    edges.forEach((edge) => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return;

      const color = relationshipColors[edge.relationship.relationship_type] || 'hsl(var(--muted-foreground))';
      
      ctx.beginPath();
      ctx.moveTo(sourceNode.x, sourceNode.y);
      ctx.lineTo(targetNode.x, targetNode.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw arrow
      const angle = Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x);
      const arrowSize = 8;
      const arrowX = (sourceNode.x + targetNode.x) / 2;
      const arrowY = (sourceNode.y + targetNode.y) / 2;

      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
        arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
        arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Draw relationship label on edge
      const label = relationshipLabels[edge.relationship.relationship_type] || edge.relationship.relationship_type;
      ctx.font = '9px system-ui';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(label, arrowX, arrowY - 10);
    });

    // Draw nodes
    nodes.forEach((node) => {
      const isHovered = hoveredNode?.id === node.id;
      const nodeRadius = node.isCenter ? 28 : 22;
      
      // Node background with glow effect for hovered
      if (isHovered && !node.isCenter) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'hsl(var(--primary) / 0.3)';
        ctx.fill();
      }
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = node.isCenter 
        ? 'hsl(var(--primary))' 
        : isHovered 
          ? 'hsl(var(--accent))' 
          : 'hsl(var(--muted))';
      ctx.fill();
      ctx.strokeStyle = node.isCenter 
        ? 'hsl(var(--primary-foreground) / 0.5)' 
        : isHovered
          ? 'hsl(var(--primary))'
          : 'hsl(var(--border))';
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.stroke();

      // Music icon inside node (simple circle)
      ctx.beginPath();
      ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = node.isCenter 
        ? 'hsl(var(--primary-foreground) / 0.6)' 
        : 'hsl(var(--muted-foreground) / 0.5)';
      ctx.fill();
    });

    // Draw labels OUTSIDE nodes (after all nodes drawn so labels are on top)
    nodes.forEach((node) => {
      const isHovered = hoveredNode?.id === node.id;
      const nodeRadius = node.isCenter ? 28 : 22;
      const labelY = node.y + nodeRadius + 14;

      // Background for label
      ctx.font = node.isCenter ? 'bold 11px system-ui' : '10px system-ui';
      const titleWidth = ctx.measureText(node.song.title).width;
      ctx.font = '9px system-ui';
      const artistWidth = ctx.measureText(node.song.artist).width;
      const bgWidth = Math.max(titleWidth, artistWidth) + 12;
      const bgHeight = 28;

      ctx.fillStyle = 'hsl(var(--background) / 0.85)';
      ctx.beginPath();
      ctx.roundRect(node.x - bgWidth / 2, labelY - 12, bgWidth, bgHeight, 4);
      ctx.fill();

      // Title
      ctx.font = node.isCenter ? 'bold 11px system-ui' : '10px system-ui';
      ctx.fillStyle = node.isCenter 
        ? 'hsl(var(--primary))' 
        : isHovered
          ? 'hsl(var(--primary))'
          : 'hsl(var(--foreground))';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.song.title, node.x, labelY - 2);
      
      // Artist
      ctx.font = '9px system-ui';
      ctx.fillStyle = 'hsl(var(--muted-foreground))';
      ctx.fillText(node.song.artist, node.x, labelY + 10);
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
        className="w-full h-full rounded-lg bg-muted/30"
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

