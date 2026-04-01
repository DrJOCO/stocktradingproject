import { Component } from "react";
import { C, Card } from "./ui.jsx";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UI render failed", error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  handleReset() {
    this.setState({ error: null });
    this.props.onReset?.();
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <Card>
        <div style={{ color: C.red, fontSize: "0.62rem", fontFamily: C.mono, letterSpacing: "0.12em", marginBottom: 10 }}>
          UI ERROR
        </div>
        <p style={{ color: C.light, fontSize: "0.72rem", fontFamily: C.mono, lineHeight: 1.7, marginBottom: 14 }}>
          A component crashed while rendering this screen. Your saved data is still intact, and you can reset the view without reloading the app.
        </p>
        <p style={{ color: C.dim, fontSize: "0.6rem", fontFamily: C.mono, lineHeight: 1.6, marginBottom: 14 }}>
          {this.state.error?.message || "Unknown rendering error"}
        </p>
        <button
          onClick={this.handleReset}
          style={{
            background: "#0d2a18",
            border: `1px solid ${C.green}`,
            color: C.green,
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          RESET VIEW
        </button>
      </Card>
    );
  }
}
