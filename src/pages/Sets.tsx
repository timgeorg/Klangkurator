import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, LayoutDashboard, Boxes } from 'lucide-react';
import { Block, storage } from '@/lib/storage';
import { BlockEditor } from '@/components/sets/BlockEditor';
import { BlockCard } from '@/components/sets/BlockCard';
import { toast } from '@/hooks/use-toast';

export default function Sets() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [deleteBlock, setDeleteBlock] = useState<Block | null>(null);

  const loadBlocks = () => {
    setBlocks(storage.getBlocks());
  };

  useEffect(() => {
    loadBlocks();
  }, []);

  const handleCreateBlock = () => {
    setEditingBlock(null);
    setEditorOpen(true);
  };

  const handleEditBlock = (block: Block) => {
    setEditingBlock(block);
    setEditorOpen(true);
  };

  const handleDeleteBlock = (block: Block) => {
    setDeleteBlock(block);
  };

  const confirmDelete = () => {
    if (deleteBlock) {
      storage.deleteBlock(deleteBlock.id);
      toast({ title: "Block deleted", description: "The block has been removed." });
      loadBlocks();
      setDeleteBlock(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8" />
            Sets
          </h1>
          <p className="text-muted-foreground mt-1">
            Build DJ sets by organizing songs into blocks and arranging them on a canvas
          </p>
        </div>
        <Button onClick={handleCreateBlock}>
          <Plus className="w-4 h-4 mr-2" />
          New Block
        </Button>
      </div>

      {/* Blocks Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Blocks</h2>
          <span className="text-muted-foreground">({blocks.length})</span>
        </div>

        {blocks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Boxes className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No blocks yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Create your first block by chaining songs together with transitions.
              </p>
              <Button onClick={handleCreateBlock}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Block
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {blocks.map(block => (
              <BlockCard 
                key={block.id} 
                block={block}
                onEdit={handleEditBlock}
                onDelete={handleDeleteBlock}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sets Section (placeholder for future) */}
      <div className="space-y-4 pt-6 border-t">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Sets</h2>
          <span className="text-sm text-muted-foreground">(Coming Soon)</span>
        </div>
        
        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-8 text-center">
            <LayoutDashboard className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Create blocks first, then arrange them into sets on a visual canvas.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Block Editor Dialog */}
      <BlockEditor
        block={editingBlock}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={loadBlocks}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteBlock} onOpenChange={() => setDeleteBlock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Block</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteBlock?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
