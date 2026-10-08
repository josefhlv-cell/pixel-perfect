export type VintageQuality = "OBSERVED_VINTAGE" | "PUBLICATION_LAG_ASSUMED";

export type VintageObservation = {
  region: string;
  series: string;
  obsDate: string;
  vintageDate: string;
  value: number;
  quality: VintageQuality;
  sourceId?: string;
  revision?: number;
};

export type PublicationLag = {
  series: string;
  lagDays: number;
  source: "OBSERVED" | "ASSUMED";
};

export type VintageQuery = {
  region?: string;
  series?: string;
  obsDateFrom?: string;
  obsDateTo?: string;
  asOf: string;
};