"use client";

/**
 * Global audio player context.
 *
 * A single <Audio> element lives here for the lifetime of the app shell,
 * so playback survives client-side navigation between pages.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface PlayerTrack {
  digestId: string;
  title: string;
  audioUrl: string;
}

interface AudioPlayerCtx {
  track: PlayerTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  /** Load a track (and optionally start playing immediately). */
  load: (track: PlayerTrack, autoPlay?: boolean) => void;
  togglePlayPause: () => void;
  seek: (seconds: number) => void;
  close: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerCtx | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Lazily create the Audio element (browser-only).
  const getAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const el = new Audio();
      el.addEventListener("play", () => setIsPlaying(true));
      el.addEventListener("pause", () => setIsPlaying(false));
      el.addEventListener("ended", () => setIsPlaying(false));
      el.addEventListener("timeupdate", () =>
        setCurrentTime(el.currentTime)
      );
      el.addEventListener("durationchange", () =>
        setDuration(isFinite(el.duration) ? el.duration : 0)
      );
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  // Cleanup on unmount (shouldn't happen, but good hygiene).
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const load = useCallback(
    (newTrack: PlayerTrack, autoPlay = true) => {
      const audio = getAudio();
      if (audio.src !== newTrack.audioUrl) {
        audio.pause();
        audio.src = newTrack.audioUrl;
        audio.load();
        setCurrentTime(0);
        setDuration(0);
      }
      setTrack(newTrack);
      if (autoPlay) {
        audio.play().catch(() => {
          // Autoplay blocked — user must tap play manually.
        });
      }
    },
    [getAudio]
  );

  const togglePlayPause = useCallback(() => {
    const audio = getAudio();
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [getAudio]);

  const seek = useCallback(
    (seconds: number) => {
      const audio = getAudio();
      audio.currentTime = seconds;
      setCurrentTime(seconds);
    },
    [getAudio]
  );

  const close = useCallback(() => {
    const audio = getAudio();
    audio.pause();
    audio.src = "";
    setTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [getAudio]);

  return (
    <AudioPlayerContext.Provider
      value={{ track, isPlaying, currentTime, duration, load, togglePlayPause, seek, close }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer(): AudioPlayerCtx {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used inside AudioPlayerProvider");
  return ctx;
}
