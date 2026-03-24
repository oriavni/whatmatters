// ─────────────────────────────────────────────────────────
// Core domain types — mirrors the DB schema
// ─────────────────────────────────────────────────────────

export type Plan = "free" | "pro" | "team";
export type DigestFrequency = "daily" | "weekly" | "monthly";
export type DigestDensity = "compact" | "balanced" | "detailed";
export type SourceType = "email" | "rss";
export type SourceStatus = "active" | "muted" | "paused" | "error";
export type DisplayTier = "full_block" | "quick_mention" | "suppressed";
export type DigestStatus = "pending" | "generating" | "ready" | "sent" | "failed";
export type DigestTrigger = "scheduled" | "on_demand" | "reply";
export type FeedbackEventType =
  | "open"
  | "click"
  | "save"
  | "pin"
  | "like"
  | "ignore_topic"
  | "rate"
  | "read_original"
  | "expand"
  | "mute_source";
export type ReplyIntent =
  | "ignore_topic"
  | "more_topic"
  | "mute_source"
  | "expand_story"
  | "read_original"
  | "change_schedule"
  | "read_now"
  | "save_item"
  | "pin_item";

// ─────────────────────────────────────────────────────────
// Database row types
// ─────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  inbound_slug: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  plan: Plan;
  status: "active" | "past_due" | "canceled" | "trialing";
  current_period_end: string | null;
  created_at: string;
}

export interface Source {
  id: string;
  user_id: string;
  type: SourceType;
  name: string;
  display_name: string | null;
  sender_address: string | null;
  sender_domain: string | null;
  rss_url: string | null;
  favicon_url: string | null;
  status: SourceStatus;
  last_received_at: string | null;
  item_count: number;
  created_at: string;
}

export interface RawItem {
  id: string;
  user_id: string;
  source_id: string | null;
  type: SourceType;
  subject: string | null;
  sender_address: string | null;
  sender_name: string | null;
  raw_html: string | null;
  raw_text: string | null;
  cleaned_text: string | null;
  word_count: number | null;
  received_at: string | null;
  status: "raw" | "cleaned" | "clustered" | "processed";
  created_at: string;
}

export interface TopicCluster {
  id: string;
  user_id: string;
  digest_id: string | null;
  label: string;
  synthesis: string | null;
  interest_score: number;
  display_tier: DisplayTier;
  item_ids: string[];
  source_ids: string[];
  created_at: string;
}

export interface Digest {
  id: string;
  user_id: string;
  trigger: DigestTrigger;
  period_start: string | null;
  period_end: string | null;
  html_body: string | null;
  text_body: string | null;
  item_count: number | null;
  cluster_count: number | null;
  sent_at: string | null;
  opened_at: string | null;
  reply_token: string | null;
  status: DigestStatus;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  digest_frequency: DigestFrequency;
  digest_time_hour: number;
  digest_day_of_week: number | null;
  timezone: string;
  density: DigestDensity;
  send_on_demand_email: boolean;
  ignored_topics: string[];
  updated_at: string;
}

export interface TopicInterest {
  id: string;
  user_id: string;
  topic_label: string;
  score: number;
  explicit: boolean;
  updated_at: string;
}

export interface FeedbackEvent {
  id: string;
  user_id: string;
  digest_id: string | null;
  cluster_id: string | null;
  raw_item_id: string | null;
  event_type: FeedbackEventType;
  value: Record<string, unknown> | null;
  created_at: string;
}

export interface ReplyAction {
  id: string;
  user_id: string;
  digest_id: string | null;
  raw_text: string;
  parsed_intent: ReplyIntent | null;
  parsed_target: string | null;
  parsed_params: Record<string, unknown> | null;
  confidence: number | null;
  status: "pending" | "executed" | "clarifying" | "failed";
  response_text: string | null;
  created_at: string;
}

export interface SavedItem {
  id: string;
  user_id: string;
  cluster_id: string | null;
  raw_item_id: string | null;
  type: "saved" | "pinned";
  note: string | null;
  created_at: string;
}

export interface JobLog {
  id: string;
  job_type: string;
  user_id: string | null;
  status: "started" | "completed" | "failed";
  metadata: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────
// Composed / API response types
// ─────────────────────────────────────────────────────────

/** A TopicCluster enriched with its contributing Source objects */
export interface EnrichedCluster extends TopicCluster {
  sources: Pick<Source, "id" | "name" | "display_name" | "favicon_url" | "type">[];
}

/** A fully rendered digest with clusters attached */
export interface DigestWithClusters extends Digest {
  clusters: EnrichedCluster[];
}

/** Source with health metadata */
export interface SourceWithHealth extends Source {
  days_since_last_item: number | null;
  is_healthy: boolean;
}

// ─────────────────────────────────────────────────────────
// API request/response shapes
// ─────────────────────────────────────────────────────────

export interface AddSourceRequest {
  input: string; // URL, RSS URL, publication name, or email
}

export interface AddSourceResponse {
  source?: Source;
  detected_type: "rss" | "email" | "unknown";
  rss_url?: string;
  suggested_action: "subscribe_with_brief_address" | "rss_added" | "manual_only";
  brief_address?: string;
  message: string;
}

export interface GenerateBriefResponse {
  digest_id: string;
  status: DigestStatus;
  estimated_seconds?: number;
}

export interface FeedbackRequest {
  event_type: FeedbackEventType;
  digest_id?: string;
  cluster_id?: string;
  raw_item_id?: string;
  value?: Record<string, unknown>;
}
