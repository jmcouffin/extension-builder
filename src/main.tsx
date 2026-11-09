import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { registerWebMcp } from "./api/webmcp";
import { startDraftPersistence } from "./state/persistence";
import { clearHistory } from "./state/store";
import { startTheme } from "./theme/store";
import "./theme/tailwind.css";

// A draft from a previous visit wins over the blank default, and is applied
// before the first paint so the ribbon never flashes the default and then swaps.
startDraftPersistence();
clearHistory();
startTheme();
// The agent tools (WebMCP, and window.pyrevitBuilder), once the draft is in.
registerWebMcp();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
