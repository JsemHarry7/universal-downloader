import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { LibraryTrack } from "@/lib/types";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerState {
  queue: LibraryTrack[];
  order: number[];
  index: number;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
}

type Action =
  | { type: "PLAY_QUEUE"; queue: LibraryTrack[]; startIndex?: number }
  | { type: "PLAY_TRACK"; track: LibraryTrack }
  | { type: "TOGGLE_PLAY" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "JUMP_TO"; orderPosition: number }
  | { type: "SET_TIME"; time: number; duration?: number }
  | { type: "SET_VOLUME"; volume: number }
  | { type: "TOGGLE_MUTE" }
  | { type: "TOGGLE_SHUFFLE" }
  | { type: "CYCLE_REPEAT" }
  | { type: "STOP" }
  | { type: "TRACK_ENDED" };

const initialState: PlayerState = {
  queue: [],
  order: [],
  index: 0,
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 0.9,
  muted: false,
  shuffle: false,
  repeat: "off",
};

function shuffleOrder(length: number, keepFirst: number): number[] {
  const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== keepFirst);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return length === 0 ? [] : [keepFirst, ...rest];
}

function linearOrder(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

function reducer(state: PlayerState, action: Action): PlayerState {
  switch (action.type) {
    case "PLAY_QUEUE": {
      const start = Math.max(0, Math.min(action.startIndex ?? 0, action.queue.length - 1));
      const baseOrder = linearOrder(action.queue.length);
      const order = state.shuffle
        ? shuffleOrder(action.queue.length, start)
        : baseOrder;
      const index = state.shuffle ? 0 : start;
      return {
        ...state,
        queue: action.queue,
        order,
        index,
        currentTime: 0,
        duration: 0,
        playing: action.queue.length > 0,
      };
    }

    case "PLAY_TRACK": {
      return reducer(state, {
        type: "PLAY_QUEUE",
        queue: [action.track],
        startIndex: 0,
      });
    }

    case "TOGGLE_PLAY":
      if (state.queue.length === 0) return state;
      return { ...state, playing: !state.playing };

    case "PLAY":
      if (state.queue.length === 0) return state;
      return { ...state, playing: true };

    case "PAUSE":
      return { ...state, playing: false };

    case "NEXT": {
      if (state.queue.length === 0) return state;
      if (state.repeat === "one") {
        return { ...state, currentTime: 0, playing: true };
      }
      const next = state.index + 1;
      if (next >= state.order.length) {
        if (state.repeat === "all") {
          return { ...state, index: 0, currentTime: 0, playing: true };
        }
        return { ...state, playing: false, currentTime: 0 };
      }
      return { ...state, index: next, currentTime: 0, playing: true };
    }

    case "PREV": {
      if (state.queue.length === 0) return state;
      if (state.currentTime > 3) {
        return { ...state, currentTime: 0 };
      }
      const prev = state.index - 1;
      if (prev < 0) {
        return { ...state, currentTime: 0 };
      }
      return { ...state, index: prev, currentTime: 0, playing: true };
    }

    case "JUMP_TO": {
      const clamped = Math.max(0, Math.min(action.orderPosition, state.order.length - 1));
      return { ...state, index: clamped, currentTime: 0, playing: true };
    }

    case "SET_TIME":
      return {
        ...state,
        currentTime: action.time,
        duration: action.duration ?? state.duration,
      };

    case "SET_VOLUME":
      return { ...state, volume: Math.max(0, Math.min(1, action.volume)), muted: false };

    case "TOGGLE_MUTE":
      return { ...state, muted: !state.muted };

    case "TOGGLE_SHUFFLE": {
      const nextShuffle = !state.shuffle;
      if (state.queue.length === 0) {
        return { ...state, shuffle: nextShuffle };
      }
      const currentTrackIndex = state.order[state.index];
      const newOrder = nextShuffle
        ? shuffleOrder(state.queue.length, currentTrackIndex)
        : linearOrder(state.queue.length);
      const newIndex = nextShuffle ? 0 : currentTrackIndex;
      return { ...state, shuffle: nextShuffle, order: newOrder, index: newIndex };
    }

    case "CYCLE_REPEAT": {
      const cycle: Record<RepeatMode, RepeatMode> = {
        off: "all",
        all: "one",
        one: "off",
      };
      return { ...state, repeat: cycle[state.repeat] };
    }

    case "STOP":
      return { ...state, queue: [], order: [], index: 0, playing: false };

    case "TRACK_ENDED":
      return reducer(state, { type: "NEXT" });

    default:
      return state;
  }
}

interface PlayerContextValue {
  state: PlayerState;
  currentTrack: LibraryTrack | null;
  dispatch: React.Dispatch<Action>;
  seek: (seconds: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = useMemo<LibraryTrack | null>(() => {
    if (state.queue.length === 0) return null;
    const i = state.order[state.index];
    if (i == null) return null;
    return state.queue[i] ?? null;
  }, [state.queue, state.order, state.index]);

  const audioSrc = currentTrack ? `/api/library/${currentTrack.id}/audio` : "";

  const seek = useCallback((seconds: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = seconds;
    dispatch({ type: "SET_TIME", time: seconds });
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = state.muted ? 0 : state.volume;
  }, [state.volume, state.muted]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (state.playing) {
      a.play().catch(() => {
        // browser blocked autoplay; surface via pause
        dispatch({ type: "PAUSE" });
      });
    } else {
      a.pause();
    }
  }, [state.playing, currentTrack?.id]);

  useEffect(() => {
    if ("mediaSession" in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist ?? undefined,
        album: currentTrack.album ?? undefined,
        artwork: currentTrack.has_artwork
          ? [
              {
                src: `/api/library/${currentTrack.id}/artwork`,
                sizes: "512x512",
                type: "image/jpeg",
              },
            ]
          : undefined,
      });

      navigator.mediaSession.setActionHandler("play", () =>
        dispatch({ type: "PLAY" }),
      );
      navigator.mediaSession.setActionHandler("pause", () =>
        dispatch({ type: "PAUSE" }),
      );
      navigator.mediaSession.setActionHandler("nexttrack", () =>
        dispatch({ type: "NEXT" }),
      );
      navigator.mediaSession.setActionHandler("previoustrack", () =>
        dispatch({ type: "PREV" }),
      );
    }
  }, [currentTrack]);

  const value = useMemo<PlayerContextValue>(
    () => ({ state, currentTrack, dispatch, seek }),
    [state, currentTrack, seek],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={(e) =>
          dispatch({
            type: "SET_TIME",
            time: e.currentTarget.currentTime,
            duration: e.currentTarget.duration,
          })
        }
        onLoadedMetadata={(e) =>
          dispatch({
            type: "SET_TIME",
            time: 0,
            duration: e.currentTarget.duration,
          })
        }
        onEnded={() => dispatch({ type: "TRACK_ENDED" })}
        onPlay={() => {
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
        }}
        onPause={() => {
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "paused";
          }
        }}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
