import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Block, DJSet, storage } from '@/lib/storage';
import { BlockEditor } from '@/components/sets/BlockEditor';
import { BlockCard } from '@/components/sets/BlockCard';
import { SetEditor } from '@/components/sets/SetEditor';
import { SetCard } from '@/components/sets/SetCard';
import { toast } from '@/hooks/use-toast';

export default function Sets() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [djSets, setDJSets] = useState<DJSet[]>([]);
  
  // Block editor state
  const [blockEditorOpen, setBlockEditorOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [deleteBlock, setDeleteBlock] = useState<Block | null>(null);
  
  // Set editor state
  const [setEditorOpen, setSetEditorOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<DJSet | null>(null);
  const [deleteSet, setDeleteSet] = useState<DJSet | null>(null);

  const loadData = async () => {
    const [loadedBlocks, loadedSets] = await Promise.all([
      storage.getBlocks(),
      storage.getSets(),
    ]);
    setBlocks(loadedBlocks);
    setDJSets(loadedSets);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Block handlers
  const handleCreateBlock = () => {
    setEditingBlock(null);
    setBlockEditorOpen(true);
  };

  const handleEditBlock = (block: Block) => {
    setEditingBlock(block);
    setBlockEditorOpen(true);
  };

  const handleDeleteBlock = (block: Block) => {
    setDeleteBlock(block);
  };

  const confirmDeleteBlock = async () => {
    if (deleteBlock) {
      await storage.deleteBlock(deleteBlock.id);
      toast({ title: "Block deleted", description: "The block has been removed." });
      loadData();
      setDeleteBlock(null);
    }
  };

  // Set handlers
  const handleCreateSet = () => {
    setEditingSet(null);
    setSetEditorOpen(true);
  };

  const handleEditSet = (djSet: DJSet) => {
    setEditingSet(djSet);
    setSetEditorOpen(true);
  };

  const handleDeleteSet = (djSet: DJSet) => {
    setDeleteSet(djSet);
  };

  const confirmDeleteSet = async () => {
    if (deleteSet) {
      await storage.deleteSet(deleteSet.id);
      toast({ title: "Set deleted", description: "The set has been removed." });
      loadData();
      setDeleteSet(null);
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
            Build DJ sets by organizing songs into blocks and arranging them together
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCreateBlock}>
            <Plus className="w-4 h-4 mr-2" />
            New Block
          </Button>
          <Button onClick={handleCreateSet}>
            <Plus className="w-4 h-4 mr-2" />
            New Set
          </Button>
        </div>
      </div>

      {/* Sets Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Sets</h2>
          <span className="text-muted-foreground">({djSets.length})</span>
        </div>

        {djSets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <LayoutDashboard className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-medium mb-2">No sets yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Create a set to arrange songs and blocks into a complete DJ performance.
              </p>
              <Button onClick={handleCreateSet}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Set
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {djSets.map(djSet => (
              <SetCard 
                key={djSet.id} 
                djSet={djSet}
                onEdit={handleEditSet}
                onDelete={handleDeleteSet}
              />
            ))}
          </div>
        )}
      </div>

      {/* Blocks Section */}
      <div className="space-y-4 pt-6 border-t">
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Blocks</h2>
          <span className="text-muted-foreground">({blocks.length})</span>
        </div>

        {blocks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Boxes className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-medium mb-2">No blocks yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Create blocks to chain songs with transitions, then use them in sets.
              </p>
              <Button variant="outline" onClick={handleCreateBlock}>
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

      {/* Block Editor Dialog */}
      <BlockEditor
        block={editingBlock}
        open={blockEditorOpen}
        onOpenChange={setBlockEditorOpen}
        onSave={loadData}
      />

      {/* Set Editor Dialog */}
      <SetEditor
        djSet={editingSet}
        open={setEditorOpen}
        onOpenChange={setSetEditorOpen}
        onSave={loadData}
      />

      {/* Delete Block Confirmation */}
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
            <AlertDialogAction onClick={confirmDeleteBlock} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Set Confirmation */}
      <AlertDialog open={!!deleteSet} onOpenChange={() => setDeleteSet(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Set</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteSet?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSet} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
