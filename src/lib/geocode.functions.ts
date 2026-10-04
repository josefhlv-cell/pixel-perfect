/** Server function: geocode address for distance filter (avoids browser CORS). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geocodeAddress, type GeoPoint } from "./geocode";

export const geocodePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(2).max(200) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; point: GeoPoint } | { ok: false; error: string }> => {
    const point = await geocodeAddress(data.query);
    if (!point) {
      return { ok: false, error: "Adresu se nepodařilo najít. Zkuste město, ulici nebo PSČ." };
    }
    return { ok: true, point };
  });
