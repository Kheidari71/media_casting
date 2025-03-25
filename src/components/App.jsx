import React, { useState, useEffect } from "react";
import LandingPage from "./LandingPage";
import Caster from "./caster/Caster";
import Player from "./Player/Player";

// Main App component that handles routing between the interfaces
export default function App() {
  const [page, setPage] = useState("landing");

  // Navigate to a specific page
  const navigateTo = (pageName) => {
    setPage(pageName);
    // Update URL without refreshing the page
    window.history.pushState(
      {},
      "",
      pageName === "landing" ? "/" : `/${pageName}`
    );
  };

  // Check URL on initial load and handle browser history navigation
  useEffect(() => {
    // Function to parse the current path and set page state
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path.includes("player")) {
        setPage("player");
      } else if (path.includes("caster")) {
        setPage("caster");
      } else {
        setPage("landing");
      }
    };

    // Set initial page based on URL
    handleLocationChange();

    // Listen to popstate event (when user clicks back/forward browser buttons)
    window.addEventListener("popstate", handleLocationChange);

    // Cleanup event listener when component unmounts
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {page === "landing" && <LandingPage onNavigate={navigateTo} />}
      {page === "caster" && <Caster />}
      {page === "player" && <Player />}
    </div>
  );
}