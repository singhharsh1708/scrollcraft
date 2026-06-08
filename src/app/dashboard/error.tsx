"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
      <h2 className="text-2xl font-bold">Couldn&apos;t load your dashboard</h2>
      <p className="text-muted-foreground max-w-md">
        Something went wrong while loading your projects. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
