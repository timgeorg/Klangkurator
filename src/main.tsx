import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applyCoverStyle, readCoverStyle } from "./lib/appearance";
import "./index.css";

applyCoverStyle(readCoverStyle());

createRoot(document.getElementById("root")!).render(<App />);
