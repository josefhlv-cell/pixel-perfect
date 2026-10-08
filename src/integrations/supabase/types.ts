export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_analyses: {
        Row: {
          created_at: string
          id: string
          kind: string
          model: string | null
          property_id: string | null
          provider: string
          result: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          model?: string | null
          property_id?: string | null
          provider: string
          result: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          model?: string | null
          property_id?: string | null
          provider?: string
          result?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          created_at: string
          estimated_cost: number | null
          id: string
          model: string | null
          provider: string
          tokens_input: number | null
          tokens_output: number | null
          tool_calls: number
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost?: number | null
          id?: string
          model?: string | null
          provider: string
          tokens_input?: number | null
          tokens_output?: number | null
          tool_calls?: number
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost?: number | null
          id?: string
          model?: string | null
          provider?: string
          tokens_input?: number | null
          tokens_output?: number | null
          tool_calls?: number
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          listing_id: string | null
          read_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          listing_id?: string | null
          read_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          listing_id?: string | null
          read_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string | null
          entity_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      calculation_scenarios: {
        Row: {
          created_at: string
          id: string
          inputs: Json
          name: string
          property_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs: Json
          name: string
          property_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs?: Json
          name?: string
          property_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculation_scenarios_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_analyses: {
        Row: {
          created_at: string
          id: string
          inputs: Json
          property_id: string | null
          results: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs: Json
          property_id?: string | null
          results: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs?: Json
          property_id?: string | null
          results?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_analyses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_profiles: {
        Row: {
          created_at: string
          id: string
          interest_rate_bps: number
          locations: string[]
          ltv_bps: number
          max_area_m2: number | null
          max_price: number | null
          min_area_m2: number | null
          min_gross_yield_bps: number | null
          min_price: number | null
          name: string
          notes: string | null
          property_types: string[]
          risk_level: string | null
          strategy: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interest_rate_bps?: number
          locations?: string[]
          ltv_bps?: number
          max_area_m2?: number | null
          max_price?: number | null
          min_area_m2?: number | null
          min_gross_yield_bps?: number | null
          min_price?: number | null
          name: string
          notes?: string | null
          property_types?: string[]
          risk_level?: string | null
          strategy?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interest_rate_bps?: number
          locations?: string[]
          ltv_bps?: number
          max_area_m2?: number | null
          max_price?: number | null
          min_area_m2?: number | null
          min_gross_yield_bps?: number | null
          min_price?: number | null
          name?: string
          notes?: string | null
          property_types?: string[]
          risk_level?: string | null
          strategy?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      listing_freshness_events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          freshness_status:
            | Database["public"]["Enums"]["freshness_status"]
            | null
          http_status: number | null
          id: string
          listing_id: string
          new_status: Database["public"]["Enums"]["availability_status"] | null
          previous_status:
            | Database["public"]["Enums"]["availability_status"]
            | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          freshness_status?:
            | Database["public"]["Enums"]["freshness_status"]
            | null
          http_status?: number | null
          id?: string
          listing_id: string
          new_status?: Database["public"]["Enums"]["availability_status"] | null
          previous_status?:
            | Database["public"]["Enums"]["availability_status"]
            | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          freshness_status?:
            | Database["public"]["Enums"]["freshness_status"]
            | null
          http_status?: number | null
          id?: string
          listing_id?: string
          new_status?: Database["public"]["Enums"]["availability_status"] | null
          previous_status?:
            | Database["public"]["Enums"]["availability_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_freshness_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_snapshots: {
        Row: {
          availability_status: Database["public"]["Enums"]["availability_status"]
          id: string
          listing_id: string
          observed_at: string
          price: number | null
          raw: Json | null
        }
        Insert: {
          availability_status: Database["public"]["Enums"]["availability_status"]
          id?: string
          listing_id: string
          observed_at?: string
          price?: number | null
          raw?: Json | null
        }
        Update: {
          availability_status?: Database["public"]["Enums"]["availability_status"]
          id?: string
          listing_id?: string
          observed_at?: string
          price?: number | null
          raw?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_snapshots_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address: string | null
          area_m2: number | null
          availability_confidence: number | null
          availability_status: Database["public"]["Enums"]["availability_status"]
          created_at: string
          created_by: string | null
          currency: string
          external_id: string | null
          first_seen_at: string
          freshness_score: number | null
          freshness_status: Database["public"]["Enums"]["freshness_status"]
          id: string
          is_sample: boolean
          last_seen_at: string | null
          last_verified_at: string | null
          latitude: number | null
          location: string | null
          longitude: number | null
          price: number | null
          property_id: string
          property_type: string | null
          rooms: string | null
          source_domain: string
          source_published_at: string | null
          source_type: string
          source_updated_at: string | null
          source_url: string
          title: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          area_m2?: number | null
          availability_confidence?: number | null
          availability_status?: Database["public"]["Enums"]["availability_status"]
          created_at?: string
          created_by?: string | null
          currency?: string
          external_id?: string | null
          first_seen_at?: string
          freshness_score?: number | null
          freshness_status?: Database["public"]["Enums"]["freshness_status"]
          id?: string
          is_sample?: boolean
          last_seen_at?: string | null
          last_verified_at?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          price?: number | null
          property_id: string
          property_type?: string | null
          rooms?: string | null
          source_domain: string
          source_published_at?: string | null
          source_type?: string
          source_updated_at?: string | null
          source_url: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          area_m2?: number | null
          availability_confidence?: number | null
          availability_status?: Database["public"]["Enums"]["availability_status"]
          created_at?: string
          created_by?: string | null
          currency?: string
          external_id?: string | null
          first_seen_at?: string
          freshness_score?: number | null
          freshness_status?: Database["public"]["Enums"]["freshness_status"]
          id?: string
          is_sample?: boolean
          last_seen_at?: string | null
          last_verified_at?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          price?: number | null
          property_id?: string
          property_type?: string | null
          rooms?: string | null
          source_domain?: string
          source_published_at?: string | null
          source_type?: string
          source_updated_at?: string | null
          source_url?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      market_comparables: {
        Row: {
          comparable_listing_id: string | null
          created_at: string
          distance_m: number | null
          id: string
          is_sample: boolean
          price_per_m2: number | null
          property_id: string
        }
        Insert: {
          comparable_listing_id?: string | null
          created_at?: string
          distance_m?: number | null
          id?: string
          is_sample?: boolean
          price_per_m2?: number | null
          property_id: string
        }
        Update: {
          comparable_listing_id?: string | null
          created_at?: string
          distance_m?: number | null
          id?: string
          is_sample?: boolean
          price_per_m2?: number | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_comparables_comparable_listing_id_fkey"
            columns: ["comparable_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_comparables_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      market_statistics: {
        Row: {
          avg_asking_price_m2: number | null
          avg_rent_m2: number | null
          city: string
          created_at: string
          id: string
          is_sample: boolean
          listings_count: number | null
          period: string
        }
        Insert: {
          avg_asking_price_m2?: number | null
          avg_rent_m2?: number | null
          city: string
          created_at?: string
          id?: string
          is_sample?: boolean
          listings_count?: number | null
          period: string
        }
        Update: {
          avg_asking_price_m2?: number | null
          avg_rent_m2?: number | null
          city?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          listings_count?: number | null
          period?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_properties: {
        Row: {
          area_m2: number | null
          city: string | null
          created_at: string
          current_value: number | null
          id: string
          interest_rate_bps: number
          monthly_expenses: number
          monthly_rent: number
          mortgage_principal: number
          name: string
          property_id: string | null
          purchase_date: string
          purchase_price: number
          term_months: number
          updated_at: string
          user_id: string
          vacancy_bps: number
        }
        Insert: {
          area_m2?: number | null
          city?: string | null
          created_at?: string
          current_value?: number | null
          id?: string
          interest_rate_bps?: number
          monthly_expenses?: number
          monthly_rent?: number
          mortgage_principal?: number
          name: string
          property_id?: string | null
          purchase_date: string
          purchase_price: number
          term_months?: number
          updated_at?: string
          user_id: string
          vacancy_bps?: number
        }
        Update: {
          area_m2?: number | null
          city?: string | null
          created_at?: string
          current_value?: number | null
          id?: string
          interest_rate_bps?: number
          monthly_expenses?: number
          monthly_rent?: number
          mortgage_principal?: number
          name?: string
          property_id?: string | null
          purchase_date?: string
          purchase_price?: number
          term_months?: number
          updated_at?: string
          user_id?: string
          vacancy_bps?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          note: string | null
          occurred_on: string
          portfolio_property_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          occurred_on: string
          portfolio_property_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          occurred_on?: string
          portfolio_property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_transactions_portfolio_property_id_fkey"
            columns: ["portfolio_property_id"]
            isOneToOne: false
            referencedRelation: "portfolio_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_valuations: {
        Row: {
          created_at: string
          id: string
          mortgage_balance: number | null
          portfolio_property_id: string
          source: string
          user_id: string
          value: number
          valued_on: string
        }
        Insert: {
          created_at?: string
          id?: string
          mortgage_balance?: number | null
          portfolio_property_id: string
          source?: string
          user_id: string
          value: number
          valued_on: string
        }
        Update: {
          created_at?: string
          id?: string
          mortgage_balance?: number | null
          portfolio_property_id?: string
          source?: string
          user_id?: string
          value?: number
          valued_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_valuations_portfolio_property_id_fkey"
            columns: ["portfolio_property_id"]
            isOneToOne: false
            referencedRelation: "portfolio_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          disclaimer_accepted_at: string | null
          display_name: string | null
          id: string
          locale: string
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          disclaimer_accepted_at?: string | null
          display_name?: string | null
          id: string
          locale?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          disclaimer_accepted_at?: string | null
          display_name?: string | null
          id?: string
          locale?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          area_m2: number | null
          building_type: string | null
          city: string | null
          condition: string | null
          created_at: string
          created_by: string | null
          description: string | null
          disposition: string | null
          district: string | null
          energy_class: string | null
          floor: number | null
          id: string
          is_sample: boolean
          latitude: number | null
          longitude: number | null
          property_type: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          area_m2?: number | null
          building_type?: string | null
          city?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          disposition?: string | null
          district?: string | null
          energy_class?: string | null
          floor?: number | null
          id?: string
          is_sample?: boolean
          latitude?: number | null
          longitude?: number | null
          property_type?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          area_m2?: number | null
          building_type?: string | null
          city?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          disposition?: string | null
          district?: string | null
          energy_class?: string | null
          floor?: number | null
          id?: string
          is_sample?: boolean
          latitude?: number | null
          longitude?: number | null
          property_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      property_snapshots: {
        Row: {
          created_at: string
          data: Json
          id: string
          property_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          property_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_snapshots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_valuations: {
        Row: {
          comparables_count: number | null
          confidence: string | null
          created_at: string
          estimated_value: number | null
          high_value: number | null
          id: string
          is_sample: boolean
          low_value: number | null
          method: string
          property_id: string
        }
        Insert: {
          comparables_count?: number | null
          confidence?: string | null
          created_at?: string
          estimated_value?: number | null
          high_value?: number | null
          id?: string
          is_sample?: boolean
          low_value?: number | null
          method: string
          property_id: string
        }
        Update: {
          comparables_count?: number | null
          confidence?: string | null
          created_at?: string
          estimated_value?: number | null
          high_value?: number | null
          id?: string
          is_sample?: boolean
          low_value?: number | null
          method?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_valuations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      reality_causal_edges: {
        Row: {
          child_entity_key: string
          child_entity_type: string
          confidence: number | null
          created_at: string
          edge_key: string
          effective_from: string
          effective_to: string | null
          expected_sign: number
          id: string
          lag_max_days: number
          lag_min_days: number
          mechanism: string
          metadata: Json
          model_version: string
          parent_entity_key: string
          parent_entity_type: string
          strength: number | null
          supersedes_id: string | null
        }
        Insert: {
          child_entity_key: string
          child_entity_type: string
          confidence?: number | null
          created_at?: string
          edge_key: string
          effective_from: string
          effective_to?: string | null
          expected_sign: number
          id?: string
          lag_max_days?: number
          lag_min_days?: number
          mechanism: string
          metadata?: Json
          model_version: string
          parent_entity_key: string
          parent_entity_type: string
          strength?: number | null
          supersedes_id?: string | null
        }
        Update: {
          child_entity_key?: string
          child_entity_type?: string
          confidence?: number | null
          created_at?: string
          edge_key?: string
          effective_from?: string
          effective_to?: string | null
          expected_sign?: number
          id?: string
          lag_max_days?: number
          lag_min_days?: number
          mechanism?: string
          metadata?: Json
          model_version?: string
          parent_entity_key?: string
          parent_entity_type?: string
          strength?: number | null
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reality_causal_edges_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "reality_causal_edges"
            referencedColumns: ["id"]
          },
        ]
      }
      reality_data_coverage: {
        Row: {
          adapter_id: string
          availability_status: string
          details: Json
          domain: string
          geography_key: string
          geography_type: string
          id: string
          last_checked_at: string
          period_end: string | null
          period_start: string | null
          provenance_quality: number | null
        }
        Insert: {
          adapter_id: string
          availability_status: string
          details?: Json
          domain: string
          geography_key: string
          geography_type: string
          id?: string
          last_checked_at?: string
          period_end?: string | null
          period_start?: string | null
          provenance_quality?: number | null
        }
        Update: {
          adapter_id?: string
          availability_status?: string
          details?: Json
          domain?: string
          geography_key?: string
          geography_type?: string
          id?: string
          last_checked_at?: string
          period_end?: string | null
          period_start?: string | null
          provenance_quality?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reality_data_coverage_adapter_id_fkey"
            columns: ["adapter_id"]
            isOneToOne: false
            referencedRelation: "reality_source_adapters"
            referencedColumns: ["id"]
          },
        ]
      }
      reality_evidence: {
        Row: {
          available_at: string
          content_hash: string
          created_at: string
          effective_from: string | null
          effective_to: string | null
          entity_key: string
          entity_type: string
          frequency: string | null
          geography_key: string
          geography_type: string
          id: string
          independence_group: string
          is_revision: boolean
          lead_class: string
          metadata: Json
          observed_at: string | null
          published_at: string | null
          publisher: string | null
          retrieved_at: string
          revision: number
          source_id: string
          source_name: string
          source_reliability: number
          source_type: string
          source_url: string | null
          supersedes_id: string | null
          unit: string | null
          value: Json
        }
        Insert: {
          available_at: string
          content_hash: string
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          entity_key: string
          entity_type: string
          frequency?: string | null
          geography_key: string
          geography_type: string
          id?: string
          independence_group: string
          is_revision?: boolean
          lead_class?: string
          metadata?: Json
          observed_at?: string | null
          published_at?: string | null
          publisher?: string | null
          retrieved_at: string
          revision?: number
          source_id: string
          source_name: string
          source_reliability?: number
          source_type: string
          source_url?: string | null
          supersedes_id?: string | null
          unit?: string | null
          value: Json
        }
        Update: {
          available_at?: string
          content_hash?: string
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          entity_key?: string
          entity_type?: string
          frequency?: string | null
          geography_key?: string
          geography_type?: string
          id?: string
          independence_group?: string
          is_revision?: boolean
          lead_class?: string
          metadata?: Json
          observed_at?: string | null
          published_at?: string | null
          publisher?: string | null
          retrieved_at?: string
          revision?: number
          source_id?: string
          source_name?: string
          source_reliability?: number
          source_type?: string
          source_url?: string | null
          supersedes_id?: string | null
          unit?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reality_evidence_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "reality_evidence_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reality_evidence_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "reality_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      reality_evidence_sources: {
        Row: {
          active: boolean
          canonical_url: string | null
          created_at: string
          default_reliability: number
          geography_scope: string | null
          id: string
          independence_group: string
          metadata: Json
          publisher: string | null
          source_name: string
          source_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          canonical_url?: string | null
          created_at?: string
          default_reliability?: number
          geography_scope?: string | null
          id?: string
          independence_group: string
          metadata?: Json
          publisher?: string | null
          source_name: string
          source_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          canonical_url?: string | null
          created_at?: string
          default_reliability?: number
          geography_scope?: string | null
          id?: string
          independence_group?: string
          metadata?: Json
          publisher?: string | null
          source_name?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      reality_falsification_results: {
        Row: {
          confidence_delta: number
          created_at: string
          evaluated_at: string
          evidence_ids: Json
          explanation: Json
          id: string
          observed_value: number | null
          passed: boolean
          sample_count: number
          test_id: string
          trust_cap_delta: number
        }
        Insert: {
          confidence_delta?: number
          created_at?: string
          evaluated_at: string
          evidence_ids?: Json
          explanation?: Json
          id?: string
          observed_value?: number | null
          passed: boolean
          sample_count?: number
          test_id: string
          trust_cap_delta?: number
        }
        Update: {
          confidence_delta?: number
          created_at?: string
          evaluated_at?: string
          evidence_ids?: Json
          explanation?: Json
          id?: string
          observed_value?: number | null
          passed?: boolean
          sample_count?: number
          test_id?: string
          trust_cap_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "reality_falsification_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "reality_falsification_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      reality_falsification_tests: {
        Row: {
          created_at: string
          evaluation_window_days: number
          hypothesis_id: string
          id: string
          metric_key: string
          operator: string
          required_sample_count: number
          severity: number
          test_key: string
          threshold: number
        }
        Insert: {
          created_at?: string
          evaluation_window_days: number
          hypothesis_id: string
          id?: string
          metric_key: string
          operator: string
          required_sample_count?: number
          severity?: number
          test_key: string
          threshold: number
        }
        Update: {
          created_at?: string
          evaluation_window_days?: number
          hypothesis_id?: string
          id?: string
          metric_key?: string
          operator?: string
          required_sample_count?: number
          severity?: number
          test_key?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "reality_falsification_tests_hypothesis_id_fkey"
            columns: ["hypothesis_id"]
            isOneToOne: false
            referencedRelation: "reality_hypotheses"
            referencedColumns: ["id"]
          },
        ]
      }
      reality_forecast_outcomes: {
        Row: {
          absolute_error: number | null
          brier_score: number | null
          decision_regret: number | null
          directional_hit: boolean | null
          forecast_id: string
          id: string
          inside_interval: boolean | null
          log_score: number | null
          metrics: Json
          outcome_as_of: string
          realized_value: number | null
          verified_at: string
        }
        Insert: {
          absolute_error?: number | null
          brier_score?: number | null
          decision_regret?: number | null
          directional_hit?: boolean | null
          forecast_id: string
          id?: string
          inside_interval?: boolean | null
          log_score?: number | null
          metrics?: Json
          outcome_as_of: string
          realized_value?: number | null
          verified_at?: string
        }
        Update: {
          absolute_error?: number | null
          brier_score?: number | null
          decision_regret?: number | null
          directional_hit?: boolean | null
          forecast_id?: string
          id?: string
          inside_interval?: boolean | null
          log_score?: number | null
          metrics?: Json
          outcome_as_of?: string
          realized_value?: number | null
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reality_forecast_outcomes_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: false
            referencedRelation: "reality_forecast_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      reality_forecast_runs: {
        Row: {
          assumptions: Json
          baseline_version: string
          calibration_confidence: number | null
          created_at: string
          data_cutoff: string
          evidence_ids: Json
          falsifiers: Json
          forecast_created_at: string
          forecast_key: string
          geography_key: string
          geography_type: string
          horizon_days: number
          id: string
          model_version: string
          p10: number | null
          p50: number | null
          p90: number | null
          probability_positive: number | null
          regime: string | null
          signal_ids: Json
          status: string
          target_key: string
        }
        Insert: {
          assumptions?: Json
          baseline_version: string
          calibration_confidence?: number | null
          created_at?: string
          data_cutoff: string
          evidence_ids?: Json
          falsifiers?: Json
          forecast_created_at?: string
          forecast_key: string
          geography_key: string
          geography_type: string
          horizon_days: number
          id?: string
          model_version: string
          p10?: number | null
          p50?: number | null
          p90?: number | null
          probability_positive?: number | null
          regime?: string | null
          signal_ids?: Json
          status?: string
          target_key: string
        }
        Update: {
          assumptions?: Json
          baseline_version?: string
          calibration_confidence?: number | null
          created_at?: string
          data_cutoff?: string
          evidence_ids?: Json
          falsifiers?: Json
          forecast_created_at?: string
          forecast_key?: string
          geography_key?: string
          geography_type?: string
          horizon_days?: number
          id?: string
          model_version?: string
          p10?: number | null
          p50?: number | null
          p90?: number | null
          probability_positive?: number | null
          regime?: string | null
          signal_ids?: Json
          status?: string
          target_key?: string
        }
        Relationships: []
      }
      reality_hypotheses: {
        Row: {
          created_at: string
          current_confidence: number
          hypothesis_key: string
          id: string
          mechanism: string
          model_version: string
          prior_confidence: number
          statement: string
          status: string
          target_key: string
          trust_cap: number
        }
        Insert: {
          created_at?: string
          current_confidence?: number
          hypothesis_key: string
          id?: string
          mechanism: string
          model_version: string
          prior_confidence?: number
          statement: string
          status?: string
          target_key: string
          trust_cap?: number
        }
        Update: {
          created_at?: string
          current_confidence?: number
          hypothesis_key?: string
          id?: string
          mechanism?: string
          model_version?: string
          prior_confidence?: number
          statement?: string
          status?: string
          target_key?: string
          trust_cap?: number
        }
        Relationships: []
      }
      reality_market_dna: {
        Row: {
          as_of: string
          confidence: number | null
          created_at: string
          evidence_ids: Json
          geography_key: string
          geography_type: string
          high_value: number | null
          horizon_days: number
          id: string
          low_value: number | null
          method_version: string
          parameter_key: string
          sample_count: number
          value: number | null
        }
        Insert: {
          as_of: string
          confidence?: number | null
          created_at?: string
          evidence_ids?: Json
          geography_key: string
          geography_type: string
          high_value?: number | null
          horizon_days: number
          id?: string
          low_value?: number | null
          method_version: string
          parameter_key: string
          sample_count?: number
          value?: number | null
        }
        Update: {
          as_of?: string
          confidence?: number | null
          created_at?: string
          evidence_ids?: Json
          geography_key?: string
          geography_type?: string
          high_value?: number | null
          horizon_days?: number
          id?: string
          low_value?: number | null
          method_version?: string
          parameter_key?: string
          sample_count?: number
          value?: number | null
        }
        Relationships: []
      }
      reality_model_candidates: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          feature_contract: Json
          hyperparameters: Json
          id: string
          model_family: string
          model_key: string
          version: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          feature_contract?: Json
          hyperparameters?: Json
          id?: string
          model_family: string
          model_key: string
          version: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          feature_contract?: Json
          hyperparameters?: Json
          id?: string
          model_family?: string
          model_key?: string
          version?: string
        }
        Relationships: []
      }
      reality_model_champions: {
        Row: {
          confidence: number | null
          geography_key: string
          geography_type: string
          horizon_days: number
          id: string
          model_id: string
          regime: string | null
          score: number
          selected_at: string
          selection_reason: Json
          supersedes_id: string | null
          target_key: string
        }
        Insert: {
          confidence?: number | null
          geography_key: string
          geography_type: string
          horizon_days: number
          id?: string
          model_id: string
          regime?: string | null
          score: number
          selected_at?: string
          selection_reason?: Json
          supersedes_id?: string | null
          target_key: string
        }
        Update: {
          confidence?: number | null
          geography_key?: string
          geography_type?: string
          horizon_days?: number
          id?: string
          model_id?: string
          regime?: string | null
          score?: number
          selected_at?: string
          selection_reason?: Json
          supersedes_id?: string | null
          target_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "reality_model_champions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "reality_model_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reality_model_champions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "reality_model_champions"
            referencedColumns: ["id"]
          },
        ]
      }
      reality_model_evaluations: {
        Row: {
          brier_score: number | null
          calibration_error: number | null
          created_at: string
          data_quality: Json
          decision_utility: number | null
          directional_accuracy: number | null
          drift_penalty: number | null
          evaluation_cutoff: string
          evaluation_method: string
          geography_key: string
          geography_type: string
          horizon_days: number
          id: string
          interval_coverage: number | null
          lead_time_days: number | null
          log_score: number | null
          mae: number | null
          model_id: string
          regime: string | null
          regret: number | null
          rmse: number | null
          robustness_score: number | null
          sample_count: number
        }
        Insert: {
          brier_score?: number | null
          calibration_error?: number | null
          created_at?: string
          data_quality?: Json
          decision_utility?: number | null
          directional_accuracy?: number | null
          drift_penalty?: number | null
          evaluation_cutoff: string
          evaluation_method: string
          geography_key: string
          geography_type: string
          horizon_days: number
          id?: string
          interval_coverage?: number | null
          lead_time_days?: number | null
          log_score?: number | null
          mae?: number | null
          model_id: string
          regime?: string | null
          regret?: number | null
          rmse?: number | null
          robustness_score?: number | null
          sample_count?: number
        }
        Update: {
          brier_score?: number | null
          calibration_error?: number | null
          created_at?: string
          data_quality?: Json
          decision_utility?: number | null
          directional_accuracy?: number | null
          drift_penalty?: number | null
          evaluation_cutoff?: string
          evaluation_method?: string
          geography_key?: string
          geography_type?: string
          horizon_days?: number
          id?: string
          interval_coverage?: number | null
          lead_time_days?: number | null
          log_score?: number | null
          mae?: number | null
          model_id?: string
          regime?: string | null
          regret?: number | null
          rmse?: number | null
          robustness_score?: number | null
          sample_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "reality_model_evaluations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "reality_model_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      reality_signal_lead_tests: {
        Row: {
          correlation: number | null
          created_at: string
          directional_accuracy: number | null
          evaluation_cutoff: string
          evidence_ids: Json
          false_alarm_rate: number | null
          geography_key: string
          geography_type: string
          id: string
          independence_adjusted_score: number | null
          lag_days: number
          lead_score: number | null
          method_version: string
          mutual_information: number | null
          p_value: number | null
          rank_correlation: number | null
          sample_count: number
          signal_key: string
          stability: number | null
          status: string
          target_key: string
          window_days: number
        }
        Insert: {
          correlation?: number | null
          created_at?: string
          directional_accuracy?: number | null
          evaluation_cutoff: string
          evidence_ids?: Json
          false_alarm_rate?: number | null
          geography_key: string
          geography_type: string
          id?: string
          independence_adjusted_score?: number | null
          lag_days: number
          lead_score?: number | null
          method_version: string
          mutual_information?: number | null
          p_value?: number | null
          rank_correlation?: number | null
          sample_count?: number
          signal_key: string
          stability?: number | null
          status?: string
          target_key: string
          window_days: number
        }
        Update: {
          correlation?: number | null
          created_at?: string
          directional_accuracy?: number | null
          evaluation_cutoff?: string
          evidence_ids?: Json
          false_alarm_rate?: number | null
          geography_key?: string
          geography_type?: string
          id?: string
          independence_adjusted_score?: number | null
          lag_days?: number
          lead_score?: number | null
          method_version?: string
          mutual_information?: number | null
          p_value?: number | null
          rank_correlation?: number | null
          sample_count?: number
          signal_key?: string
          stability?: number | null
          status?: string
          target_key?: string
          window_days?: number
        }
        Relationships: []
      }
      reality_signal_observations: {
        Row: {
          as_of: string
          created_at: string
          data_quality: Json
          direction: number | null
          evidence_ids: Json
          geography_key: string
          geography_type: string
          id: string
          independence_groups: Json
          lead_class: string
          method_version: string
          observed_at: string | null
          signal_key: string
          unit: string | null
          value: number | null
          value_json: Json | null
        }
        Insert: {
          as_of: string
          created_at?: string
          data_quality?: Json
          direction?: number | null
          evidence_ids?: Json
          geography_key: string
          geography_type: string
          id?: string
          independence_groups?: Json
          lead_class?: string
          method_version: string
          observed_at?: string | null
          signal_key: string
          unit?: string | null
          value?: number | null
          value_json?: Json | null
        }
        Update: {
          as_of?: string
          created_at?: string
          data_quality?: Json
          direction?: number | null
          evidence_ids?: Json
          geography_key?: string
          geography_type?: string
          id?: string
          independence_groups?: Json
          lead_class?: string
          method_version?: string
          observed_at?: string | null
          signal_key?: string
          unit?: string | null
          value?: number | null
          value_json?: Json | null
        }
        Relationships: []
      }
      reality_source_adapters: {
        Row: {
          access_protocol: string
          adapter_key: string
          canonical_url: string | null
          created_at: string
          data_domains: Json
          frequencies: Json
          geography_scopes: Json
          historical_start: string | null
          id: string
          independence_group: string
          last_success_at: string | null
          latency_class: string
          metadata: Json
          point_in_time_safe: boolean
          publication_timestamp_available: boolean
          publisher: string | null
          reliability: number | null
          retrieval_timestamp_recorded: boolean
          revision_policy: string | null
          source_id: string | null
          source_name: string
          status: string
          updated_at: string
        }
        Insert: {
          access_protocol: string
          adapter_key: string
          canonical_url?: string | null
          created_at?: string
          data_domains?: Json
          frequencies?: Json
          geography_scopes?: Json
          historical_start?: string | null
          id?: string
          independence_group: string
          last_success_at?: string | null
          latency_class?: string
          metadata?: Json
          point_in_time_safe?: boolean
          publication_timestamp_available?: boolean
          publisher?: string | null
          reliability?: number | null
          retrieval_timestamp_recorded?: boolean
          revision_policy?: string | null
          source_id?: string | null
          source_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          access_protocol?: string
          adapter_key?: string
          canonical_url?: string | null
          created_at?: string
          data_domains?: Json
          frequencies?: Json
          geography_scopes?: Json
          historical_start?: string | null
          id?: string
          independence_group?: string
          last_success_at?: string | null
          latency_class?: string
          metadata?: Json
          point_in_time_safe?: boolean
          publication_timestamp_available?: boolean
          publisher?: string | null
          reliability?: number | null
          retrieval_timestamp_recorded?: boolean
          revision_policy?: string | null
          source_id?: string | null
          source_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reality_source_adapters_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "reality_evidence_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      reality_world_state_snapshots: {
        Row: {
          as_of: string
          confidence: number | null
          created_at: string
          evidence_count: number
          evidence_ids: Json
          geography_key: string
          geography_type: string
          id: string
          missingness: Json
          regime: string | null
          state: Json
        }
        Insert: {
          as_of: string
          confidence?: number | null
          created_at?: string
          evidence_count?: number
          evidence_ids?: Json
          geography_key: string
          geography_type: string
          id?: string
          missingness?: Json
          regime?: string | null
          state: Json
        }
        Update: {
          as_of?: string
          confidence?: number | null
          created_at?: string
          evidence_count?: number
          evidence_ids?: Json
          geography_key?: string
          geography_type?: string
          id?: string
          missingness?: Json
          regime?: string | null
          state?: Json
        }
        Relationships: []
      }
      rent_estimates: {
        Row: {
          confidence: string | null
          created_at: string
          high_rent: number | null
          id: string
          is_sample: boolean
          low_rent: number | null
          method: string
          monthly_rent: number | null
          property_id: string
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          high_rent?: number | null
          id?: string
          is_sample?: boolean
          low_rent?: number | null
          method: string
          monthly_rent?: number | null
          property_id: string
        }
        Update: {
          confidence?: string | null
          created_at?: string
          high_rent?: number | null
          id?: string
          is_sample?: boolean
          low_rent?: number | null
          method?: string
          monthly_rent?: number | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_estimates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      search_results: {
        Row: {
          created_at: string
          deal_priority: number | null
          id: string
          listing_id: string | null
          match_score: number | null
          search_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_priority?: number | null
          id?: string
          listing_id?: string | null
          match_score?: number | null
          search_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_priority?: number | null
          id?: string
          listing_id?: string | null
          match_score?: number | null
          search_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_results_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_results_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      searches: {
        Row: {
          created_at: string
          generated_queries: string[] | null
          id: string
          investor_profile_id: string | null
          last_run_at: string | null
          provider: string | null
          query: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_queries?: string[] | null
          id?: string
          investor_profile_id?: string | null
          last_run_at?: string | null
          provider?: string | null
          query: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generated_queries?: string[] | null
          id?: string
          investor_profile_id?: string | null
          last_run_at?: string | null
          provider?: string | null
          query?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "searches_investor_profile_id_fkey"
            columns: ["investor_profile_id"]
            isOneToOne: false
            referencedRelation: "investor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_reality_evidence_available_at: {
        Args: {
          p_as_of: string
          p_geography_key?: string
          p_geography_type?: string
        }
        Returns: {
          available_at: string
          content_hash: string
          created_at: string
          effective_from: string | null
          effective_to: string | null
          entity_key: string
          entity_type: string
          frequency: string | null
          geography_key: string
          geography_type: string
          id: string
          independence_group: string
          is_revision: boolean
          lead_class: string
          metadata: Json
          observed_at: string | null
          published_at: string | null
          publisher: string | null
          retrieved_at: string
          revision: number
          source_id: string
          source_name: string
          source_reliability: number
          source_type: string
          source_url: string | null
          supersedes_id: string | null
          unit: string | null
          value: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "reality_evidence"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      schedule_watchdog_cron: { Args: { _secret: string }; Returns: undefined }
    }
    Enums: {
      alert_severity: "info" | "opportunity" | "warning"
      availability_status:
        | "ACTIVE_CONFIRMED"
        | "ACTIVE_UNCONFIRMED"
        | "RESERVED"
        | "SOLD"
        | "REMOVED"
        | "EXPIRED"
        | "UNKNOWN"
      freshness_status:
        | "FRESH"
        | "RECENT"
        | "AGING"
        | "STALE"
        | "EXPIRED"
        | "UNKNOWN"
      plan_tier: "FREE" | "PRO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_severity: ["info", "opportunity", "warning"],
      availability_status: [
        "ACTIVE_CONFIRMED",
        "ACTIVE_UNCONFIRMED",
        "RESERVED",
        "SOLD",
        "REMOVED",
        "EXPIRED",
        "UNKNOWN",
      ],
      freshness_status: [
        "FRESH",
        "RECENT",
        "AGING",
        "STALE",
        "EXPIRED",
        "UNKNOWN",
      ],
      plan_tier: ["FREE", "PRO"],
    },
  },
} as const
