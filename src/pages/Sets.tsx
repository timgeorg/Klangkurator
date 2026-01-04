import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, LayoutDashboard, Boxes, ArrowRight } from 'lucide-react';

export default function Sets() {
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
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Set
        </Button>
      </div>

      {/* Concept explanation */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="w-5 h-5" />
              Blocks
            </CardTitle>
            <CardDescription>
              Groups of songs connected by transitions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A block is a sequence of songs with defined transitions between them. 
              Once you've tested a transition works well, save it as a block for reuse.
            </p>
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg text-sm">
              <div className="px-3 py-1.5 bg-primary/20 rounded border">Song A</div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="px-3 py-1.5 bg-primary/20 rounded border">Song B</div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="px-3 py-1.5 bg-primary/20 rounded border">Song C</div>
            </div>
            <Button variant="outline" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Create Block
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5" />
              Sets
            </CardTitle>
            <CardDescription>
              Visual canvas to arrange blocks into a complete DJ set
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Arrange your blocks on a canvas to plan your DJ set. 
              Connect blocks together and visualize the flow of your performance.
            </p>
            <div className="p-3 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/30 min-h-[80px] flex items-center justify-center">
              <span className="text-sm text-muted-foreground">Canvas preview</span>
            </div>
            <Button variant="outline" className="w-full" disabled>
              <Plus className="w-4 h-4 mr-2" />
              Create Set
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <LayoutDashboard className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No sets yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Start by creating blocks from your song library, then combine them into sets.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
