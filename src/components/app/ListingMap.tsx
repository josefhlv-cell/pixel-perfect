/** Browser-only MapLibre map. Import lazily (see MapLazy). */
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  layer: "listing" | "deal" | "portfolio" | "watchlist";
  href?: string;
}

const COLORS: Record<MapPoint["layer"], string> = { listing: "#8b93a7", deal: "#e8b34a", portfolio: "#3fbf7f", watchlist: "#b07cf0" };

export default function ListingMap({ points, onOpen, height = 520 }: { points: MapPoint[]; onOpen?: (href: string) => void; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!el.current) return;
    map.current = new maplibregl.Map({
      container: el.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [15.5, 49.8],
      zoom: 6.2,
      attributionControl: { compact: true },
    });
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    return () => map.current?.remove();
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((x) => x.remove());
    markers.current = points.map((p) => {
      const dot = document.createElement("button");
      dot.setAttribute("aria-label", p.title);
      dot.style.cssText = `width:14px;height:14px;border-radius:9999px;background:${COLORS[p.layer]};border:2px solid rgba(0,0,0,.6);cursor:pointer`;
      const box = document.createElement("div");
      box.style.cssText = "font-family:inherit;min-width:180px";
      const h = document.createElement("div");
      h.style.cssText = "font-weight:600;font-size:13px";
      h.textContent = p.title;
      const s = document.createElement("div");
      s.style.cssText = "font-size:12px;opacity:.75;margin-top:2px";
      s.textContent = p.subtitle;
      box.append(h, s);
      if (p.href && onOpen) {
        const b = document.createElement("button");
        b.textContent = "Otevřít detail →";
        b.style.cssText = "margin-top:6px;font-size:12px;color:#e8b34a;cursor:pointer";
        b.onclick = () => onOpen(p.href!);
        box.append(b);
      }
      return new maplibregl.Marker({ element: dot }).setLngLat([p.lng, p.lat]).setPopup(new maplibregl.Popup({ offset: 10 }).setDOMContent(box)).addTo(m);
    });
  }, [points, onOpen]);

  return <div ref={el} style={{ height }} className="w-full overflow-hidden rounded-md border" />;
}
