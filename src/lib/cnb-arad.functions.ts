import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { syncCnbArad } from "./cnb-arad.server";

export const syncCnbAradData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      setIds: z.array(z.string().regex(/^\d{1,8}$/)).min(1).max(10).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      const result = await syncCnbArad(context.supabase, data.setIds);
      return { ok: true as const, result };
    } catch (error) {
      console.error("[cnb-arad] sync failed", error);
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Import dat ČNB ARAD selhal.",
      };
    }
  });
