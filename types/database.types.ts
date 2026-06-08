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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audio_digests: {
        Row: {
          created_at: string
          digest_id: string
          duration_sec: number | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          status: string
          storage_path: string | null
          tts_chars: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_id: string
          duration_sec?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          status?: string
          storage_path?: string | null
          tts_chars?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_id?: string
          duration_sec?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          status?: string
          storage_path?: string | null
          tts_chars?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_digests_digest_id_fkey"
            columns: ["digest_id"]
            isOneToOne: false
            referencedRelation: "digests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_digests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_codes: {
        Row: {
          access_type: string
          code: string
          created_at: string
          created_by: string | null
          discount_percent: number | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          note: string | null
          plan_granted: Database["public"]["Enums"]["subscription_plan"]
          redemptions_count: number
        }
        Insert: {
          access_type: string
          code: string
          created_at?: string
          created_by?: string | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          note?: string | null
          plan_granted: Database["public"]["Enums"]["subscription_plan"]
          redemptions_count?: number
        }
        Update: {
          access_type?: string
          code?: string
          created_at?: string
          created_by?: string | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          note?: string | null
          plan_granted?: Database["public"]["Enums"]["subscription_plan"]
          redemptions_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupon_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupon_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      digests: {
        Row: {
          compiled_json: Json | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          html_body: string | null
          id: string
          llm_tokens_input: number | null
          llm_tokens_output: number | null
          metadata: Json
          opened_at: string | null
          period_end: string
          period_start: string
          plain_body: string | null
          postmark_message_id: string | null
          sent_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["digest_status"]
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compiled_json?: Json | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          html_body?: string | null
          id?: string
          llm_tokens_input?: number | null
          llm_tokens_output?: number | null
          metadata?: Json
          opened_at?: string | null
          period_end: string
          period_start: string
          plain_body?: string | null
          postmark_message_id?: string | null
          sent_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["digest_status"]
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compiled_json?: Json | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          html_body?: string | null
          id?: string
          llm_tokens_input?: number | null
          llm_tokens_output?: number | null
          metadata?: Json
          opened_at?: string | null
          period_end?: string
          period_start?: string
          plain_body?: string | null
          postmark_message_id?: string | null
          sent_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["digest_status"]
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_sources: {
        Row: {
          category: string
          coolness_score: number
          created_at: string
          description: string
          feed_url: string | null
          freshness_score: number
          id: string
          is_active: boolean
          language: string
          name: string
          source_type: string
          tags: string[]
          trust_score: number
          updated_at: string
          url: string
        }
        Insert: {
          category: string
          coolness_score?: number
          created_at?: string
          description: string
          feed_url?: string | null
          freshness_score?: number
          id?: string
          is_active?: boolean
          language?: string
          name: string
          source_type: string
          tags?: string[]
          trust_score?: number
          updated_at?: string
          url: string
        }
        Update: {
          category?: string
          coolness_score?: number
          created_at?: string
          description?: string
          feed_url?: string | null
          freshness_score?: number
          id?: string
          is_active?: boolean
          language?: string
          name?: string
          source_type?: string
          tags?: string[]
          trust_score?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      feedback_events: {
        Row: {
          cluster_id: string | null
          created_at: string
          digest_id: string | null
          id: string
          metadata: Json | null
          raw_item_id: string | null
          type: Database["public"]["Enums"]["feedback_type"]
          user_id: string
        }
        Insert: {
          cluster_id?: string | null
          created_at?: string
          digest_id?: string | null
          id?: string
          metadata?: Json | null
          raw_item_id?: string | null
          type: Database["public"]["Enums"]["feedback_type"]
          user_id: string
        }
        Update: {
          cluster_id?: string | null
          created_at?: string
          digest_id?: string | null
          id?: string
          metadata?: Json | null
          raw_item_id?: string | null
          type?: Database["public"]["Enums"]["feedback_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_events_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "topic_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_events_digest_id_fkey"
            columns: ["digest_id"]
            isOneToOne: false
            referencedRelation: "digests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_events_raw_item_id_fkey"
            columns: ["raw_item_id"]
            isOneToOne: false
            referencedRelation: "raw_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_logs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          job_name: string
          metadata: Json
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          metadata?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          metadata?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_config: {
        Row: {
          deal_active: boolean
          deal_label: string
          deal_price_monthly: number
          deal_slots_remaining: number
          deal_slots_total: number
          id: string
          price_monthly: number
          pro_audio_limit: number
          pro_description: string
          pro_label: string
          pro_price_monthly: number
          pro_visible: boolean
          trial_days: number
          updated_at: string
        }
        Insert: {
          deal_active?: boolean
          deal_label?: string
          deal_price_monthly?: number
          deal_slots_remaining?: number
          deal_slots_total?: number
          id?: string
          price_monthly?: number
          pro_audio_limit?: number
          pro_description?: string
          pro_label?: string
          pro_price_monthly?: number
          pro_visible?: boolean
          trial_days?: number
          updated_at?: string
        }
        Update: {
          deal_active?: boolean
          deal_label?: string
          deal_price_monthly?: number
          deal_slots_remaining?: number
          deal_slots_total?: number
          id?: string
          price_monthly?: number
          pro_audio_limit?: number
          pro_description?: string
          pro_label?: string
          pro_price_monthly?: number
          pro_visible?: boolean
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      raw_items: {
        Row: {
          body_text: string | null
          created_at: string
          id: string
          is_processed: boolean
          is_promotional: boolean
          metadata: Json
          raw_html_path: string | null
          received_at: string
          sender_email: string | null
          sender_name: string | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          subject: string | null
          summary: string | null
          user_id: string
        }
        Insert: {
          body_text?: string | null
          created_at?: string
          id?: string
          is_processed?: boolean
          is_promotional?: boolean
          metadata?: Json
          raw_html_path?: string | null
          received_at?: string
          sender_email?: string | null
          sender_name?: string | null
          source_id?: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          subject?: string | null
          summary?: string | null
          user_id: string
        }
        Update: {
          body_text?: string | null
          created_at?: string
          id?: string
          is_processed?: boolean
          is_promotional?: boolean
          metadata?: Json
          raw_html_path?: string | null
          received_at?: string
          sender_email?: string | null
          sender_name?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
          subject?: string | null
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reply_actions: {
        Row: {
          action: Database["public"]["Enums"]["reply_action_type"]
          cluster_id: string | null
          created_at: string
          digest_id: string | null
          id: string
          parsed_at: string
          raw_item_id: string | null
          raw_reply: string | null
          user_id: string
          via: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["reply_action_type"]
          cluster_id?: string | null
          created_at?: string
          digest_id?: string | null
          id?: string
          parsed_at?: string
          raw_item_id?: string | null
          raw_reply?: string | null
          user_id: string
          via?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["reply_action_type"]
          cluster_id?: string | null
          created_at?: string
          digest_id?: string | null
          id?: string
          parsed_at?: string
          raw_item_id?: string | null
          raw_reply?: string | null
          user_id?: string
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reply_actions_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "topic_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reply_actions_digest_id_fkey"
            columns: ["digest_id"]
            isOneToOne: false
            referencedRelation: "digests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reply_actions_raw_item_id_fkey"
            columns: ["raw_item_id"]
            isOneToOne: false
            referencedRelation: "raw_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reply_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          cluster_id: string | null
          created_at: string
          id: string
          note: string | null
          raw_item_id: string | null
          user_id: string
        }
        Insert: {
          cluster_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          raw_item_id?: string | null
          user_id: string
        }
        Update: {
          cluster_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          raw_item_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "topic_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_items_raw_item_id_fkey"
            columns: ["raw_item_id"]
            isOneToOne: false
            referencedRelation: "raw_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          last_fetched_at: string | null
          metadata: Json
          name: string
          status: Database["public"]["Enums"]["source_status"]
          type: Database["public"]["Enums"]["source_type"]
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_fetched_at?: string | null
          metadata?: Json
          name: string
          status?: Database["public"]["Enums"]["source_status"]
          type: Database["public"]["Enums"]["source_type"]
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_fetched_at?: string | null
          metadata?: Json
          name?: string
          status?: Database["public"]["Enums"]["source_status"]
          type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          creem_customer_id: string | null
          creem_subscription_id: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          creem_customer_id?: string | null
          creem_subscription_id?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          creem_customer_id?: string | null
          creem_subscription_id?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_flags: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: boolean
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value?: boolean
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: boolean
        }
        Relationships: []
      }
      topic_clusters: {
        Row: {
          created_at: string
          digest_id: string
          id: string
          rank: number
          raw_item_ids: string[]
          score: number
          summary: string | null
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_id: string
          id?: string
          rank?: number
          raw_item_ids?: string[]
          score?: number
          summary?: string | null
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_id?: string
          id?: string
          rank?: number
          raw_item_ids?: string[]
          score?: number
          summary?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_clusters_digest_id_fkey"
            columns: ["digest_id"]
            isOneToOne: false
            referencedRelation: "digests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_clusters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_interests: {
        Row: {
          created_at: string
          id: string
          topic: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          topic: string
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          topic?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "topic_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_suppressions: {
        Row: {
          created_at: string
          digests_remaining: number
          id: string
          source_cluster_id: string | null
          suppress_level: number
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digests_remaining: number
          id?: string
          source_cluster_id?: string | null
          suppress_level: number
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digests_remaining?: number
          id?: string
          source_cluster_id?: string | null
          suppress_level?: number
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_suppressions_source_cluster_id_fkey"
            columns: ["source_cluster_id"]
            isOneToOne: false
            referencedRelation: "topic_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          digest_day: number | null
          digest_frequency: string
          digest_time: string
          email_format: string
          ignored_topics: string[]
          topics: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_day?: number | null
          digest_frequency?: string
          digest_time?: string
          email_format?: string
          ignored_topics?: string[]
          topics?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_day?: number | null
          digest_frequency?: string
          digest_time?: string
          email_format?: string
          ignored_topics?: string[]
          topics?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          inbound_slug: string
          is_frozen: boolean
          is_premium_override: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          inbound_slug: string
          is_frozen?: boolean
          is_premium_override?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          inbound_slug?: string
          is_frozen?: boolean
          is_premium_override?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      digest_status: "pending" | "generating" | "ready" | "sent" | "failed"
      feedback_type: "thumbs_up" | "thumbs_down" | "skip" | "save"
      job_status: "queued" | "running" | "done" | "failed"
      reply_action_type: "expand" | "save" | "skip" | "share" | "unsubscribe"
      source_status: "active" | "paused" | "error"
      source_type: "rss" | "newsletter" | "manual"
      subscription_plan: "free" | "pro" | "premium"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "paused"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      digest_status: ["pending", "generating", "ready", "sent", "failed"],
      feedback_type: ["thumbs_up", "thumbs_down", "skip", "save"],
      job_status: ["queued", "running", "done", "failed"],
      reply_action_type: ["expand", "save", "skip", "share", "unsubscribe"],
      source_status: ["active", "paused", "error"],
      source_type: ["rss", "newsletter", "manual"],
      subscription_plan: ["free", "pro", "premium"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "paused",
      ],
    },
  },
} as const
