import { Component, type ErrorInfo, type ReactNode } from "react";

/** Catches a page that fails to render and shows a way out, instead of a blank screen. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page failed to render:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page-pad">
        <div className="error-note" role="alert" style={{ display: "grid", gap: 10, maxWidth: 560 }}>
          <b>This page could not be shown.</b>
          <span>Something in this view failed to load. Go back to the case list, or reload the page to try again.</span>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="btn btn-secondary" href="#/app/cases">Back to cases</a>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
          </span>
        </div>
      </div>
    );
  }
}
