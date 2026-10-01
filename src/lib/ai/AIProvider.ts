/** Provider-independent AI contract. The app never depends on a specific vendor. */

export type ClaimKind = "FACT" | "ESTIMATE" | "ASSUMPTION" | "UNKNOWN";
export interface Claim {
  text: string;
  kind: ClaimKind;
}

export interface PropertyAnalysisInput {
  property: Record<string, unknown>; // structured, trusted fields
  metrics: Record<string, unknown>; // computed by the calculation engine
  listingText?: string | null; // UNTRUSTED external content
}

export interface PropertyAnalysis {
  summary: string;
  advantages: Claim[];
  risks: Claim[];
  missingInfo: string[];
  sellerQuestions: string[];
  dueDiligence: string[];
  scenarios: Claim[];
  redFlags: Claim[];
}

export interface DealAnalysisInput extends PropertyAnalysisInput {}
export interface DealExplanation {
  explanation: string;
}
export interface ListingExtractionInput {
  url: string;
  rawText: string;
}
export interface NormalizedListing {
  price: number | null;
  area_m2: number | null;
  rooms: string | null;
  city: string | null;
  address: string | null;
  statusMarker: "SOLD" | "RESERVED" | null;
}
export interface InvestorSearchProfile {
  query: string;
  locations?: string[];
  maxPrice?: number | null;
}
export interface MarketSummaryInput {
  stats: Record<string, unknown>[];
}
export interface MarketSummary {
  insight: string;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  analyzeProperty(input: PropertyAnalysisInput): Promise<PropertyAnalysis>;
  explainDeal(input: DealAnalysisInput): Promise<DealExplanation>;
  extractListing(input: ListingExtractionInput): Promise<NormalizedListing>;
  generateSearchQueries(input: InvestorSearchProfile): Promise<string[]>;
  summarizeMarket(input: MarketSummaryInput): Promise<MarketSummary>;
}

export class AIUnavailableError extends Error {
  constructor(
    message = "AI unavailable",
    public status?: number,
  ) {
    super(message);
  }
}

export interface AIUsage {
  tokensInput: number | null;
  tokensOutput: number | null;
}

/** Web discovery is a separate, replaceable abstraction. */
export interface PropertySearchRequest {
  query: string;
  locations?: string[];
  maxPrice?: number | null;
}
export interface WebDiscoveryResult {
  url: string;
  title: string;
  snippet?: string;
}
export interface WebDiscoveryProvider {
  readonly name: string;
  readonly connected: boolean;
  searchListings(input: PropertySearchRequest): Promise<WebDiscoveryResult[]>;
}
