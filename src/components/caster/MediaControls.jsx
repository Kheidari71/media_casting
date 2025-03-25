import React from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Maximize, ToggleLeft, ToggleRight } from "lucide-react";
import { formatTime } from "../../utils/mediaUtils";

export default function MediaControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  autoplay,
  handlePrevious,
  handleNext,
  togglePlay,
  handleSeek,
  handleVolumeChange,
  toggleAutoplay,
  handleFullscreen,
}) {
  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm">{formatTime(currentTime)}</span>
        <span className="text-sm">{formatTime(duration)}</span>
      </div>

      <input
        type="range"
        min="0"
        max={duration || 100}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
      />

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={handlePrevious}
            className="p-2 rounded-full hover:bg-gray-700"
          >
            <SkipBack size={24} />
          </button>

          <button
            onClick={togglePlay}
            className="p-3 bg-teal-600 hover:bg-teal-700 rounded-full"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>

          <button
            onClick={handleNext}
            className="p-2 rounded-full hover:bg-gray-700"
          >
            <SkipForward size={24} />
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Volume2 size={20} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <button
            onClick={toggleAutoplay}
            className="flex items-center space-x-1 text-sm"
          >
            <span>Autoplay</span>
            {autoplay ? (
              <ToggleRight size={20} className="text-teal-400" />
            ) : (
              <ToggleLeft size={20} />
            )}
          </button>

          <button
            onClick={handleFullscreen}
            className="p-2 rounded-full hover:bg-gray-700"
          >
            <Maximize size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}