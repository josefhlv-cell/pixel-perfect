import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Live Czech HPI contract for a signed-in user. The result is not stored. */
export const getCzechHousePriceForecast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { issueCzechHousePriceForecast } = await import("./future-os/house-price.server");
    return issueCzechHousePriceForecast();
  });
