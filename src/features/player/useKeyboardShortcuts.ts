import { useEffect } from "react";
import { usePlayer } from "./PlayerProvider";

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function usePlayerShortcuts(): void {
  const { dispatch, state, seek } = usePlayer();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (state.queue.length === 0) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          dispatch({ type: "TOGGLE_PLAY" });
          break;
        case "ArrowRight":
          if (e.shiftKey) {
            e.preventDefault();
            dispatch({ type: "NEXT" });
          } else if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            seek(Math.min(state.duration, state.currentTime + 5));
          }
          break;
        case "ArrowLeft":
          if (e.shiftKey) {
            e.preventDefault();
            dispatch({ type: "PREV" });
          } else if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            seek(Math.max(0, state.currentTime - 5));
          }
          break;
        case "KeyM":
          e.preventDefault();
          dispatch({ type: "TOGGLE_MUTE" });
          break;
        case "KeyS":
          e.preventDefault();
          dispatch({ type: "TOGGLE_SHUFFLE" });
          break;
        case "KeyR":
          e.preventDefault();
          dispatch({ type: "CYCLE_REPEAT" });
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch, state, seek]);
}
