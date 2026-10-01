/** Provider factory. Selected by AI_PROVIDER env (default: lovable). */
import type { AIProvider } from "./AIProvider";
import { CurrentAIProvider } from "./CurrentAIProvider.server";
import { GrokProvider } from "./GrokProvider.server";
import { OpenAIProvider } from "./OpenAIProvider.server";

export function getAIProvider(): AIProvider {
  const which = (process.env.AI_PROVIDER ?? "lovable").toLowerCase();
  if (which === "grok") return new GrokProvider(process.env.GROK_API_KEY);
  if (which === "openai") return new OpenAIProvider(process.env.OPENAI_API_KEY);
  return new CurrentAIProvider(process.env.LOVABLE_API_KEY ?? "");
}
