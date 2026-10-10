import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Live Czech HPI contract. The signed-in user can read the journal; only the service role can append it. */
export const getCzechHousePriceForecast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { issueAndRememberCzechHousePrices } = await import("./future-os/house-price.server");
    return issueAndRememberCzechHousePrices(context.supabase);
  });
