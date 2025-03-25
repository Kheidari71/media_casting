import React from "react";
import { Cast, Play } from "lucide-react";

// Landing page with Cast and Player options
export default function LandingPage({ onNavigate }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-teal-400 mb-8">
        Media Casting System
      </h1>

      <div className="flex flex-col sm:flex-row gap-6">
        <button
          onClick={() => onNavigate("caster")}
          className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-6 px-12 rounded-lg flex flex-col items-center gap-3 transition-all transform hover:scale-105"
        >
          <Cast size={48} />
          <span className="text-xl">Cast</span>
          <p className="text-sm text-teal-200 text-center">
            Control and manage media playback
          </p>
        </button>

        <button
          onClick={() => onNavigate("player")}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-6 px-12 rounded-lg flex flex-col items-center gap-3 transition-all transform hover:scale-105"
        >
          <Play size={48} />
          <span className="text-xl">Player</span>
          <p className="text-sm text-gray-300 text-center">
            Display synchronized media content
          </p>
        </button>
      </div>

      <p className="mt-12 text-gray-400 text-center max-w-md">
        Choose "Cast" to control media playback or "Player" to display the
        synchronized content on this device.
      </p>
    </div>
  );
}