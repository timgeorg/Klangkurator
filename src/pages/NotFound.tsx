import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { Shape } from "@/components/brand";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="k-grain flex min-h-full items-center px-6 py-16 md:px-12">
      <div className="mx-auto grid w-full max-w-4xl items-center gap-12 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h1 className="k-display max-w-[14ch]">This page isn’t in your library.</h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Nothing in Klangkurator lives at this address. Your tracks, sets and settings are where you left them.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild>
              <Link to="/">Back to Library</Link>
            </Button>
            <span className="k-num text-xs text-muted-foreground">404 · {location.pathname}</span>
          </div>
        </div>
        <div aria-hidden className="relative hidden h-56 w-56 md:block">
          <Shape kind="circle" className="absolute left-0 top-0 w-36 text-foreground" />
          <Shape kind="half" turn={3} className="absolute bottom-0 right-0 w-40 text-signal" />
          <Shape kind="quarter" className="absolute bottom-0 left-6 w-16 text-foreground/25" />
        </div>
      </div>
    </div>
  );
};

export default NotFound;
