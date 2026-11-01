import { Redo2Icon, Undo2Icon } from "lucide-react";
import { useEffect } from "react";
import { useStore as useZustand } from "zustand";
import { Button } from "@/components/ui/button";
import { redo, undo, useStore } from "../state/store";

function isTextTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export function HistoryControls() {
  const canUndo = useZustand(useStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useZustand(useStore.temporal, (s) => s.futureStates.length > 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || isTextTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) undo();
      else if ((key === "z" && e.shiftKey) || key === "y") redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Button
        variant="toolbar"
        size="toolbar"
        id="undoAction"
        disabled={!canUndo}
        title="Undo (Ctrl/Cmd+Z)"
        aria-label="Undo"
        onClick={undo}
      >
        <Undo2Icon aria-hidden="true" />
      </Button>
      <Button
        variant="toolbar"
        size="toolbar"
        id="redoAction"
        disabled={!canRedo}
        title="Redo (Ctrl/Cmd+Shift+Z)"
        aria-label="Redo"
        onClick={redo}
      >
        <Redo2Icon aria-hidden="true" />
      </Button>
    </>
  );
}
