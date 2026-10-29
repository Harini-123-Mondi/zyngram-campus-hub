import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { PublicPortfolio } from "./StudentFeatures.jsx";
import "./styles.css";

const portfolioMatch = window.location.pathname.match(/^\/portfolio\/([^/]+)$/);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Campus Hub offline support could not be registered.", error);
    });
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {portfolioMatch ? <PublicPortfolio shareToken={decodeURIComponent(portfolioMatch[1])} /> : <App />}
  </React.StrictMode>
);
