import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Music, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md bg-gradient-card border-border/50 shadow-elevated text-center">
        <CardContent className="p-8">
          <div className="mb-6">
            <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
            <h2 className="text-xl font-semibold text-foreground mb-2">Track Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The page you're looking for doesn't exist in this collection.
            </p>
          </div>
          <Button asChild className="bg-gradient-primary hover:shadow-glow">
            <a href="/">
              <Home className="w-4 h-4 mr-2" />
              Back to Library
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
