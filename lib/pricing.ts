/**
 * Fetches pricing config from DB. Used by marketing pages (Server Components).
 * Falls back to hardcoded defaults if the table isn't available yet.
 */
import { createServiceClient } from "@/lib/supabase/service";

export interface PricingConfig {
  price_monthly: number;
  trial_days: number;
  deal_active: boolean;
  deal_label: string;
  deal_price_monthly: number;
  deal_slots_total: number;
  deal_slots_remaining: number;
  /** Whether the Pro plan card is shown on the public pricing page. */
  pro_visible: boolean;
  pro_price_monthly: number;
  pro_label: string;
  /** Monthly Audio Brief allowance for Pro subscribers. */
  pro_audio_limit: number;
  /** Short marketing description for the Pro plan. */
  pro_description: string;
}

const DEFAULTS: PricingConfig = {
  price_monthly: 7,
  trial_days: 7,
  deal_active: false,
  deal_label: "Founding member — 30% off forever",
  deal_price_monthly: 4.99,
  deal_slots_total: 50,
  deal_slots_remaining: 50,
  pro_visible: false,
  pro_price_monthly: 12,
  pro_label: "Pro",
  pro_audio_limit: 20,
  pro_description: "Audio Briefs included — listen to every digest",
};

export async function getPricingConfig(): Promise<PricingConfig> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("pricing_config")
      .select("*")
      .eq("id", "default")
      .single();
    if (!data) return DEFAULTS;
    return { ...DEFAULTS, ...(data as unknown as Partial<PricingConfig>) } as PricingConfig;
  } catch {
    return DEFAULTS;
  }
}
