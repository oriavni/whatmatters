/**
 * Supabase database type definitions.
 * Reflects supabase/migrations/20260323000001_initial_schema.sql
 *
 * Usage:
 *   import { Database } from "@/types/database.types";
 *   const supabase = createClient<Database>(...);
 *   const { data } = await supabase.from("users").select("*");
 *   // data is Database["public"]["Tables"]["users"]["Row"][]
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          inbound_slug: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          inbound_slug: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          inbound_slug?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan: "free" | "pro";
          status: "trialing" | "active" | "past_due" | "canceled" | "paused";
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: "free" | "pro";
          status?: "trialing" | "active" | "past_due" | "canceled" | "paused";
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: "free" | "pro";
          status?: "trialing" | "active" | "past_due" | "canceled" | "paused";
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sources: {
        Row: {
          id: string;
          user_id: string;
          type: "rss" | "newsletter" | "manual";
          name: string;
          url: string | null;
          status: "active" | "paused" | "error";
          last_fetched_at: string | null;
          error_message: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "rss" | "newsletter" | "manual";
          name: string;
          url?: string | null;
          status?: "active" | "paused" | "error";
          last_fetched_at?: string | null;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "rss" | "newsletter" | "manual";
          name?: string;
          url?: string | null;
          status?: "active" | "paused" | "error";
          last_fetched_at?: string | null;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      raw_items: {
        Row: {
          id: string;
          user_id: string;
          source_id: string | null;
          source_type: "rss" | "newsletter" | "manual";
          subject: string | null;
          sender_name: string | null;
          sender_email: string | null;
          received_at: string;
          raw_html_path: string | null;
          body_text: string | null;
          summary: string | null;
          is_processed: boolean;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_id?: string | null;
          source_type: "rss" | "newsletter" | "manual";
          subject?: string | null;
          sender_name?: string | null;
          sender_email?: string | null;
          received_at?: string;
          raw_html_path?: string | null;
          body_text?: string | null;
          summary?: string | null;
          is_processed?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_id?: string | null;
          source_type?: "rss" | "newsletter" | "manual";
          subject?: string | null;
          sender_name?: string | null;
          sender_email?: string | null;
          received_at?: string;
          raw_html_path?: string | null;
          body_text?: string | null;
          summary?: string | null;
          is_processed?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          digest_frequency: string;
          digest_time: string;
          digest_day: number | null;
          topics: string[];
          ignored_topics: string[];
          email_format: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          digest_frequency?: string;
          digest_time?: string;
          digest_day?: number | null;
          topics?: string[];
          ignored_topics?: string[];
          email_format?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          digest_frequency?: string;
          digest_time?: string;
          digest_day?: number | null;
          topics?: string[];
          ignored_topics?: string[];
          email_format?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      topic_interests: {
        Row: {
          id: string;
          user_id: string;
          topic: string;
          weight: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic: string;
          weight?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic?: string;
          weight?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      digests: {
        Row: {
          id: string;
          user_id: string;
          status: "pending" | "generating" | "ready" | "sent" | "failed";
          period_start: string;
          period_end: string;
          subject: string | null;
          html_body: string | null;
          plain_body: string | null;
          sent_at: string | null;
          opened_at: string | null;
          postmark_message_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: "pending" | "generating" | "ready" | "sent" | "failed";
          period_start: string;
          period_end: string;
          subject?: string | null;
          html_body?: string | null;
          plain_body?: string | null;
          sent_at?: string | null;
          opened_at?: string | null;
          postmark_message_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: "pending" | "generating" | "ready" | "sent" | "failed";
          period_start?: string;
          period_end?: string;
          subject?: string | null;
          html_body?: string | null;
          plain_body?: string | null;
          sent_at?: string | null;
          opened_at?: string | null;
          postmark_message_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      topic_clusters: {
        Row: {
          id: string;
          digest_id: string;
          user_id: string;
          topic: string;
          summary: string | null;
          rank: number;
          score: number;
          raw_item_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          digest_id: string;
          user_id: string;
          topic: string;
          summary?: string | null;
          rank?: number;
          score?: number;
          raw_item_ids?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          digest_id?: string;
          user_id?: string;
          topic?: string;
          summary?: string | null;
          rank?: number;
          score?: number;
          raw_item_ids?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      feedback_events: {
        Row: {
          id: string;
          user_id: string;
          digest_id: string | null;
          cluster_id: string | null;
          raw_item_id: string | null;
          type: "thumbs_up" | "thumbs_down" | "skip" | "save";
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          digest_id?: string | null;
          cluster_id?: string | null;
          raw_item_id?: string | null;
          type: "thumbs_up" | "thumbs_down" | "skip" | "save";
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          digest_id?: string | null;
          cluster_id?: string | null;
          raw_item_id?: string | null;
          type?: "thumbs_up" | "thumbs_down" | "skip" | "save";
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reply_actions: {
        Row: {
          id: string;
          user_id: string;
          digest_id: string | null;
          cluster_id: string | null;
          raw_item_id: string | null;
          action: "expand" | "save" | "skip" | "share" | "unsubscribe";
          raw_reply: string | null;
          parsed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          digest_id?: string | null;
          cluster_id?: string | null;
          raw_item_id?: string | null;
          action: "expand" | "save" | "skip" | "share" | "unsubscribe";
          raw_reply?: string | null;
          parsed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          digest_id?: string | null;
          cluster_id?: string | null;
          raw_item_id?: string | null;
          action?: "expand" | "save" | "skip" | "share" | "unsubscribe";
          raw_reply?: string | null;
          parsed_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      saved_items: {
        Row: {
          id: string;
          user_id: string;
          raw_item_id: string | null;
          cluster_id: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          raw_item_id?: string | null;
          cluster_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          raw_item_id?: string | null;
          cluster_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      job_logs: {
        Row: {
          id: string;
          user_id: string | null;
          job_name: string;
          status: "queued" | "running" | "done" | "failed";
          started_at: string | null;
          finished_at: string | null;
          error: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          job_name: string;
          status?: "queued" | "running" | "done" | "failed";
          started_at?: string | null;
          finished_at?: string | null;
          error?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          job_name?: string;
          status?: "queued" | "running" | "done" | "failed";
          started_at?: string | null;
          finished_at?: string | null;
          error?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      pricing_config: {
        Row: {
          id: string;
          price_monthly: number;
          trial_days: number;
          deal_active: boolean;
          deal_label: string;
          deal_price_monthly: number;
          deal_slots_total: number;
          deal_slots_remaining: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          price_monthly?: number;
          trial_days?: number;
          deal_active?: boolean;
          deal_label?: string;
          deal_price_monthly?: number;
          deal_slots_total?: number;
          deal_slots_remaining?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          price_monthly?: number;
          trial_days?: number;
          deal_active?: boolean;
          deal_label?: string;
          deal_price_monthly?: number;
          deal_slots_total?: number;
          deal_slots_remaining?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      topic_suppressions: {
        Row: {
          id: string;
          user_id: string;
          topic: string;
          source_cluster_id: string | null;
          suppress_level: number;
          digests_remaining: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic: string;
          source_cluster_id?: string | null;
          suppress_level: number;
          digests_remaining: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic?: string;
          source_cluster_id?: string | null;
          suppress_level?: number;
          digests_remaining?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      source_type: "rss" | "newsletter" | "manual";
      source_status: "active" | "paused" | "error";
      digest_status: "pending" | "generating" | "ready" | "sent" | "failed";
      feedback_type: "thumbs_up" | "thumbs_down" | "skip" | "save";
      reply_action_type: "expand" | "save" | "skip" | "share" | "unsubscribe";
      job_status: "queued" | "running" | "done" | "failed";
      subscription_status: "trialing" | "active" | "past_due" | "canceled" | "paused";
      subscription_plan: "free" | "pro";
    };
  };
};

// Convenience row type aliases
export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
export type SourceRow = Database["public"]["Tables"]["sources"]["Row"];
export type RawItemRow = Database["public"]["Tables"]["raw_items"]["Row"];
export type UserPreferencesRow = Database["public"]["Tables"]["user_preferences"]["Row"];
export type TopicInterestRow = Database["public"]["Tables"]["topic_interests"]["Row"];
export type DigestRow = Database["public"]["Tables"]["digests"]["Row"];
export type TopicClusterRow = Database["public"]["Tables"]["topic_clusters"]["Row"];
export type FeedbackEventRow = Database["public"]["Tables"]["feedback_events"]["Row"];
export type ReplyActionRow = Database["public"]["Tables"]["reply_actions"]["Row"];
export type SavedItemRow = Database["public"]["Tables"]["saved_items"]["Row"];
export type JobLogRow = Database["public"]["Tables"]["job_logs"]["Row"];
export type TopicSuppressionRow = Database["public"]["Tables"]["topic_suppressions"]["Row"];
export type PricingConfigRow = Database["public"]["Tables"]["pricing_config"]["Row"];
