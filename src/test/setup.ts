import "@testing-library/jest-dom/vitest";

// jsdom has no layout engine, so no ResizeObserver; components that watch
// their own size get an inert one.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver as unknown as typeof ResizeObserver;
