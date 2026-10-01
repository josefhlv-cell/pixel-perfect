/**
 * Grok provider — placeholder until GROK_API_KEY is provided.
 * Activate with AI_PROVIDER=grok. Implement the same AIProvider contract
 * (xAI exposes an OpenAI-compatible API), no other code changes required.
 */
import { AIUnavailableError, type AIProvider } from "./AIProvider";

export class GrokProvider implements AIProvider {
  readonly name = "grok";
  readonly model = "grok";
  constructor(private apiKey: string | undefined) {}
  private na(): never {
    throw new AIUnavailableError(this.apiKey ? "Grok provider not implemented yet" : "GROK_API_KEY missing");
  }
  analyzeProperty() { return this.na(); }
  explainDeal() { return this.na(); }
  extractListing() { return this.na(); }
  generateSearchQueries() { return this.na(); }
  summarizeMarket() { return this.na(); }
}
