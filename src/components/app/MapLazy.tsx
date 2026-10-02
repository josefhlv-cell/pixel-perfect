import { lazy, Suspense, useEffect, useState } from "react";
import type { MapPoint } from "./ListingMap";
import { Skeleton } from "@/components/ui/skeleton";

const ListingMap = lazy(() => import("./ListingMap"));

export function MapLazy(props: { points: MapPoint[]; onOpen?: (href: string) => void; height?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const fallback = <Skeleton style={{ height: props.height ?? 520 }} className="w-full" />;
  if (!ready) return fallback;
  return (
    <Suspense fallback={fallback}>
      <ListingMap {...props} />
    </Suspense>
  );
}
export type { MapPoint };
