"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface DeliveryScheduleFormProps {
  initialFrequency: string;
  initialTime: string;
  initialDay: number;
  initialTimezone: string;
}

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const TIMES = [
  "06:00", "07:00", "08:00", "09:00", "10:00",
  "12:00", "14:00", "16:00", "18:00", "20:00", "22:00",
];

// Common IANA timezones — enough for global coverage without a 500-item dropdown.
const TIMEZONES = [
  { value: "UTC",                   label: "UTC" },
  { value: "America/New_York",      label: "New York (ET)" },
  { value: "America/Chicago",       label: "Chicago (CT)" },
  { value: "America/Denver",        label: "Denver (MT)" },
  { value: "America/Los_Angeles",   label: "Los Angeles (PT)" },
  { value: "America/Toronto",       label: "Toronto (ET)" },
  { value: "America/Sao_Paulo",     label: "São Paulo (BRT)" },
  { value: "Europe/London",         label: "London (GMT/BST)" },
  { value: "Europe/Paris",          label: "Paris (CET)" },
  { value: "Europe/Berlin",         label: "Berlin (CET)" },
  { value: "Europe/Moscow",         label: "Moscow (MSK)" },
  { value: "Africa/Cairo",          label: "Cairo (EET)" },
  { value: "Asia/Jerusalem",        label: "Jerusalem (IST)" },
  { value: "Asia/Dubai",            label: "Dubai (GST)" },
  { value: "Asia/Kolkata",          label: "Mumbai / Delhi (IST)" },
  { value: "Asia/Bangkok",          label: "Bangkok (ICT)" },
  { value: "Asia/Singapore",        label: "Singapore (SGT)" },
  { value: "Asia/Shanghai",         label: "Shanghai (CST)" },
  { value: "Asia/Tokyo",            label: "Tokyo (JST)" },
  { value: "Australia/Sydney",      label: "Sydney (AEST)" },
  { value: "Pacific/Auckland",      label: "Auckland (NZST)" },
];

const KNOWN_VALUES = new Set(TIMEZONES.map((t) => t.value));

function formatTime(t: string) {
  const [h] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:00 ${period}`;
}

export function DeliveryScheduleForm({
  initialFrequency,
  initialTime,
  initialDay,
  initialTimezone,
}: DeliveryScheduleFormProps) {
  const [frequency, setFrequency] = useState(initialFrequency);
  const [time, setTime]           = useState(initialTime);
  const [day, setDay]             = useState(initialDay);
  const [timezone, setTimezone]   = useState(initialTimezone);
  const [saving, setSaving]       = useState(false);

  // On first mount, auto-detect browser timezone if the stored value is still
  // the default "UTC" and the browser reports something different.
  useEffect(() => {
    if (initialTimezone === "UTC") {
      try {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (browserTz && browserTz !== "UTC") {
          setTimezone(browserTz);
        }
      } catch {
        // Intl not available — keep UTC
      }
    }
  }, [initialTimezone]);

  // Resolve which label/value to show for the current timezone.
  // If it's a known value, show it normally.
  // If it's an unknown IANA zone (e.g. "America/Indiana/Indianapolis"),
  // show a fallback entry so the select isn't blank.
  const selectOptions = KNOWN_VALUES.has(timezone)
    ? TIMEZONES
    : [{ value: timezone, label: timezone }, ...TIMEZONES];

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digest_frequency: frequency,
          digest_time: time,
          digest_day: day,
          timezone,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Delivery schedule saved");
    } catch {
      toast.error("Could not save — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function handlePause() {
    setSaving(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest_frequency: "off" }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setFrequency("off");
      toast.success("Email delivery paused");
    } catch {
      toast.error("Could not save — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {frequency === "off" && (
        <p className="text-sm text-muted-foreground rounded-lg border bg-muted/30 p-3">
          Email delivery is paused. Choose a schedule below and save to resume.
        </p>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Frequency */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Frequency</p>
            <Select value={frequency === "off" ? "daily" : frequency} onValueChange={(v) => v && setFrequency(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Day — only for weekly */}
          {frequency === "weekly" && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Day</p>
              <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Time */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Time</p>
            <Select value={time} onValueChange={(v) => v && setTime(v)}>
              <SelectTrigger className="w-28">
                <SelectValue>{formatTime(time)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TIMES.map((t) => (
                  <SelectItem key={t} value={t}>{formatTime(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Timezone</p>
            <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectOptions.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {frequency !== "off" && (
        <p className="text-xs text-muted-foreground">
          <button
            onClick={handlePause}
            disabled={saving}
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Pause email delivery
          </button>
        </p>
      )}
    </div>
  );
}
