"use client";

/**
 * Client-side wrapper for the app shell.
 * Provides the global audio player context so playback persists
 * across client-side navigations.
 */

import { AudioPlayerProvider } from "@/lib/audio/player-context";
import { GlobalAudioPlayer } from "@/components/audio/GlobalAudioPlayer";
import type { ReactNode } from "react";

export function AppClientLayout({ children }: { children: ReactNode }) {
  return (
    <AudioPlayerProvider>
      {children}
      <GlobalAudioPlayer />
    </AudioPlayerProvider>
  );
}
