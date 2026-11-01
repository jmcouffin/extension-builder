import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearHistory, redo, undo, useStore } from "./store";

beforeEach(() => {
  useStore.getState().reset();
  clearHistory();
});

describe("history", () => {
  it("undoes and redoes a change", () => {
    useStore.getState().addTab();
    expect(Object.keys(useStore.getState().tabs)).toHaveLength(2);
    undo();
    expect(Object.keys(useStore.getState().tabs)).toHaveLength(1);
    redo();
    expect(Object.keys(useStore.getState().tabs)).toHaveLength(2);
  });

  it("drops the redo line when a new change is made", () => {
    useStore.getState().addTab();
    undo();
    useStore.getState().addTab();
    expect(useStore.temporal.getState().futureStates).toHaveLength(0);
  });

  it("does not record opening a dialog", () => {
    useStore.getState().openModal({ mode: "edit", elementId: "x" });
    expect(useStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it("keeps a burst of typing in the name as one step", () => {
    vi.useFakeTimers();
    try {
      for (const name of ["M", "My", "My E", "My Ex"]) {
        useStore.getState().setExtensionName(name);
        vi.advanceTimersByTime(100);
      }
      expect(useStore.temporal.getState().pastStates).toHaveLength(1);
      undo();
      expect(useStore.getState().extensionName).toBe("My Extension");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps quick different actions as separate steps", () => {
    useStore.getState().addTab();
    useStore.getState().addTab();
    expect(useStore.temporal.getState().pastStates).toHaveLength(2);
  });

  it("undoes a reset", () => {
    useStore.getState().addTab();
    useStore.getState().reset();
    undo();
    expect(Object.keys(useStore.getState().tabs)).toHaveLength(2);
  });
});
