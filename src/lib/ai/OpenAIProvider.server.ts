/**
 * Direct OpenAI provider — placeholder until OPENAI_API_KEY is provided.
 * Activate with AI_PROVIDER=openai. Same AIProvider contract.
 */
import { AIUnavailableError, type AIProvider } from "./AIProvider";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly model = "openai";
  constructor(private apiKey: string | undefined) {}
  private na(): never {
    throw new AIUnavailableError(this.apiKey ? "OpenAI provider not implemented yet" : "OPENAI_API_KEY missing");
  }
  analyzeProperty() { return this.na(); }
  explainDeal() { return this.na(); }
  extractListing() { return this.na(); }
  generateSearchQueries() { return this.na(); }
  summarizeMarket() { return this.na(); }
}
