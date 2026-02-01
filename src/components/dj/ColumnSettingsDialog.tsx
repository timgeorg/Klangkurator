import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Column Settings</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-2">
          <p className="text-xs text-muted-foreground mb-3">
            Drag to reorder columns. Toggle visibility with the switch.
          </p>
          
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
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
                    "flex items-center gap-3 px-2 py-2 rounded-md border transition-all",
                    "bg-background hover:bg-muted/50 cursor-grab active:cursor-grabbing",
                    isDragging && "opacity-50 border-dashed",
                    isDragOver && "border-primary bg-primary/5",
                    !isDragging && !isDragOver && "border-transparent"
                  )}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  
                  <span className={cn(
                    "flex-1 text-sm",
                    !isVisible && "text-muted-foreground"
                  )}>
                    {def?.label || columnId}
                  </span>
                  
                  <Switch
                    checked={isVisible}
                    onCheckedChange={() => toggleVisibility(columnId)}
                    className="flex-shrink-0"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
