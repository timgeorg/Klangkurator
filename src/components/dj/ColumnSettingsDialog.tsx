import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GripVertical, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UseColumnConfigReturn, COLUMN_DEFINITIONS } from '@/hooks/useColumnConfig';

interface ColumnSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnConfig: UseColumnConfigReturn;
}

export function ColumnSettingsDialog({
  open,
  onOpenChange,
  columnConfig,
}: ColumnSettingsDialogProps) {
  const { columnOrder, columnVisibility, toggleVisibility, moveColumn, resetToDefaults } = columnConfig;
  
  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = draggedIndex;
    
    if (fromIndex !== null && fromIndex !== toIndex) {
      moveColumn(fromIndex, toIndex);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, moveColumn]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Columns</DialogTitle>
          <DialogDescription>Drag to reorder. Switch a column off to hide it.</DialogDescription>
        </DialogHeader>

        <div>
          <div className="-mx-2 max-h-[58vh] space-y-0.5 overflow-y-auto px-2">
            {columnOrder.map((columnId, index) => {
              const def = COLUMN_DEFINITIONS[columnId];
              const isVisible = columnVisibility[columnId];
              const isDragging = draggedIndex === index;
              const isDragOver = dragOverIndex === index;
              
              return (
                <div
                  key={columnId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex cursor-grab items-center gap-3 rounded-md border px-2 py-1.5 transition-colors duration-fast active:cursor-grabbing",
                    "hover:bg-accent",
                    isDragging && "border-dashed opacity-50",
                    isDragOver && "border-signal bg-signal-soft",
                    !isDragging && !isDragOver && "border-transparent",
                  )}
                >
                  <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />

                  <span className={cn("flex-1 text-[13px]", !isVisible && "text-muted-foreground")}>
                    {columnId === "play" ? "Number, play and edit" : columnId === "cover" ? "Cover" : def?.label || columnId}
                  </span>

                  <Switch
                    checked={isVisible}
                    onCheckedChange={() => toggleVisibility(columnId)}
                    aria-label={`Show ${def?.label || columnId}`}
                    className="flex-shrink-0"
                  />
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" size="sm" onClick={resetToDefaults} className="text-muted-foreground">
            <RotateCcw />
            Reset to default
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
