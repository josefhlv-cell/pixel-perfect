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
      [_ in never]: never
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
