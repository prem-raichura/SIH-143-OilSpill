import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/source-serif-4/400-italic.css";
import "@fontsource/source-serif-4/600-italic.css";
import "./design/tokens.css";
import "./design/base.css";
import "./design/app.css";
import "./design/landing.css";
import "./design/console.css";
import { createRoot } from "react-dom/client";
import App from "./App";
import { startClock } from "./store/clock";

startClock();
// No StrictMode: its double mount re-initialises deck.gl and three.js contexts and trips their asserts.
createRoot(document.getElementById("root")!).render(<App />);
