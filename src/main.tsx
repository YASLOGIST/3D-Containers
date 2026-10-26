import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

/**
 * Last-resort shell: a render failure must degrade to a recoverable
 * message, never a blank page. Inline styles keep it independent of CSS.
 */
class RootErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#08090b",
          color: "#e8ecef",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "26rem",
            border: "1px solid rgba(226,81,60,0.5)",
            background: "#14181d",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#e2513c", letterSpacing: "0.14em", fontSize: 11 }}>
            WORKBENCH FAULT
          </p>
          <h1 style={{ fontSize: 20, margin: "0.6rem 0" }}>
            Something failed while drawing the lab
          </h1>
          <p style={{ color: "#a7b2bc", fontSize: 14, lineHeight: 1.6 }}>
            Your configuration is stored in the page address — reloading
            restores the same model, finish and inspection setup.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1rem",
              background: "#ffb020",
              color: "#08090b",
              border: 0,
              padding: "0.55rem 1.1rem",
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Reload workbench
          </button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
