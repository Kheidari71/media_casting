import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Maximize,
  List,
  Plus,
  Trash2,
  X,
  ToggleLeft,
  ToggleRight,
  Cast,
  Square,
  Folder,
} from "lucide-react";
import { io } from "socket.io-client";

// Socket connection setup (would connect to your actual WebSocket server)
const socket = io("https://www.sitebrew.ai/api/<SITE_ID>/socket", {
  transports: ["websocket"],
  autoConnect: true,
});

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

  // Check URL on initial load
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes("player")) {
      setPage("player");
    } else if (path.includes("caster")) {
      setPage("caster");
    } else {
      setPage("landing");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {page === "landing" && <LandingPage onNavigate={navigateTo} />}
      {page === "caster" && <Caster />}
      {page === "player" && <Player />}
    </div>
  );
}

// Landing page with Cast and Player options
function LandingPage({ onNavigate }) {
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

// Directory Selection Modal
function DirectorySelectionModal({ isOpen, onClose, onAddDirectory }) {
  const [directoryName, setDirectoryName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  const handleSubmit = () => {
    if (!directoryName.trim()) {
      alert("Please enter a directory name");
      return;
    }

    if (selectedFiles.length === 0) {
      alert("Please select at least one file");
      return;
    }

    // Process files and create media items
    const mediaItems = selectedFiles
      .map((file) => {
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");

        // Create object URL for the file
        const fileUrl = URL.createObjectURL(file);

        return {
          id: Date.now() + Math.random(),
          name: file.name,
          path: fileUrl,
          type: isVideo ? "video" : isImage ? "image" : "unknown",
          size: file.size,
        };
      })
      .filter((item) => item.type !== "unknown"); // Filter out unsupported file types

    onAddDirectory(directoryName, mediaItems);
    onClose();
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Add Media Directory</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Directory Name
          </label>
          <input
            type="text"
            value={directoryName}
            onChange={(e) => setDirectoryName(e.target.value)}
            placeholder="Enter directory name"
            className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 text-white"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Select Media Files
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            onClick={openFileSelector}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded border border-gray-600"
          >
            <Folder size={16} />
            <span>Browse Files</span>
          </button>

          {selectedFiles.length > 0 && (
            <div className="mt-2 text-sm text-gray-400">
              {selectedFiles.length} file(s) selected
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded"
          >
            Add Directory
          </button>
        </div>
      </div>
    </div>
  );
}

// Caster component - full-featured media player and playlist management
function Caster() {
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoplay, setAutoplay] = useState(() => {
    return localStorage.getItem("autoplay") === "true";
  });
  const [directories, setDirectories] = useState([]);
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [isCasting, setIsCasting] = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);

  const mediaRef = useRef(null);

  // Function to add a directory and its media files
  const addDirectory = (directoryName, mediaItems) => {
    if (!directoryName || mediaItems.length === 0) return;

    // Add the directory to the list
    const newDirectory = { name: directoryName, id: Date.now() };
    setDirectories([...directories, newDirectory]);

    // Add the media items to the playlist
    const newPlaylist = [...playlist, ...mediaItems];
    setPlaylist(newPlaylist);

    // Notify player about playlist update if casting
    if (isCasting) {
      socket.emit("playlist_update", newPlaylist);
    }
  };

  // Function to remove a directory and its files
  const removeDirectory = (dirId) => {
    // Find the directory to remove
    const dirToRemove = directories.find((dir) => dir.id === dirId);
    if (!dirToRemove) return;

    // Remove the directory from the list
    const newDirectories = directories.filter((dir) => dir.id !== dirId);
    setDirectories(newDirectories);

    // In a real app, you would know which files belong to which directory
    // For this demo, we'll just keep the playlist as is
    // In a real implementation, you would filter out files from the removed directory
  };

  const removeFromPlaylist = (id) => {
    const newPlaylist = playlist.filter((item) => item.id !== id);
    setPlaylist(newPlaylist);

    if (isCasting) {
      socket.emit("playlist_update", newPlaylist);
    }

    // If we removed the current item, adjust currentIndex
    if (currentIndex >= newPlaylist.length) {
      setCurrentIndex(Math.max(0, newPlaylist.length - 1));
    }
  };

  const playMedia = (index) => {
    setCurrentIndex(index);
    setIsPlaying(true);

    // Notify player if casting
    if (isCasting) {
      socket.emit("media_change", {
        index,
        item: playlist[index],
        isPlaying: true,
      });
    }
  };

  const togglePlay = () => {
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);

    if (newPlayingState) {
      mediaRef.current?.play();
    } else {
      mediaRef.current?.pause();
    }

    if (isCasting) {
      socket.emit("playback_state", { isPlaying: newPlayingState });
    }
  };

  const handleNext = () => {
    if (playlist.length === 0) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    playMedia(nextIndex);
  };

  const handlePrevious = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playMedia(prevIndex);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (mediaRef.current) {
      mediaRef.current.volume = newVolume;
    }

    if (isCasting) {
      socket.emit("volume_change", { volume: newVolume });
    }
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);

      if (isCasting) {
        socket.emit("time_update", {
          currentTime: mediaRef.current.currentTime,
        });
      }
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (mediaRef.current) {
      mediaRef.current.currentTime = newTime;
    }

    if (isCasting) {
      socket.emit("time_update", { currentTime: newTime });
    }
  };

  const toggleAutoplay = () => {
    const newAutoplay = !autoplay;
    setAutoplay(newAutoplay);
    localStorage.setItem("autoplay", newAutoplay.toString());

    if (isCasting) {
      socket.emit("autoplay_change", { autoplay: newAutoplay });
    }
  };

  const handleFullscreen = () => {
    if (mediaRef.current) {
      if (mediaRef.current.requestFullscreen) {
        mediaRef.current.requestFullscreen();
      }
    }
  };

  const toggleCasting = () => {
    const newCastingState = !isCasting;
    setIsCasting(newCastingState);

    // Notify player about casting state
    socket.emit("casting_state", {
      isCasting: newCastingState,
      // If starting to cast, send current state
      ...(newCastingState && {
        playlist,
        currentIndex,
        currentItem: playlist[currentIndex] || null,
        isPlaying,
        currentTime,
        volume,
        autoplay,
      }),
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Handle media ended event
  const handleMediaEnded = () => {
    if (autoplay && playlist.length > 0) {
      handleNext();
    } else {
      setIsPlaying(false);

      if (isCasting) {
        socket.emit("playback_state", { isPlaying: false });
      }
    }
  };

  // Effect to handle socket events from Player
  useEffect(() => {
    socket.on("request_state", () => {
      if (isCasting) {
        // Send current state to player
        socket.emit("casting_state", {
          isCasting: true,
          playlist,
          currentIndex,
          currentItem: playlist[currentIndex] || null,
          isPlaying,
          currentTime,
          volume,
          autoplay,
        });
      }
    });

    return () => {
      socket.off("request_state");
    };
  }, [
    playlist,
    currentIndex,
    isPlaying,
    currentTime,
    volume,
    autoplay,
    isCasting,
  ]);

  // Effect to sync media playback state when it changes
  useEffect(() => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current
          .play()
          .catch((e) => console.error("Playback error:", e));
      } else {
        mediaRef.current.pause();
      }
    }
  }, [isPlaying, currentIndex, playlist]);

  // Effect to handle duration change
  useEffect(() => {
    const handleDurationChange = () => {
      if (mediaRef.current) {
        setDuration(mediaRef.current.duration || 0);
      }
    };

    const mediaElement = mediaRef.current;
    if (mediaElement) {
      mediaElement.addEventListener("durationchange", handleDurationChange);
      mediaElement.addEventListener("loadedmetadata", handleDurationChange);
    }

    return () => {
      if (mediaElement) {
        mediaElement.removeEventListener(
          "durationchange",
          handleDurationChange
        );
        mediaElement.removeEventListener(
          "loadedmetadata",
          handleDurationChange
        );
      }
    };
  }, [currentIndex, playlist]);

  // Current media item
  const currentItem = playlist[currentIndex];

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-teal-400">Media Caster</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleCasting}
            className={`flex items-center space-x-1 px-3 py-1 rounded ${
              isCasting
                ? "bg-red-600 hover:bg-red-700"
                : "bg-teal-600 hover:bg-teal-700"
            }`}
          >
            {isCasting ? (
              <>
                <Square size={16} />
                <span>Stop Casting</span>
              </>
            ) : (
              <>
                <Cast size={16} />
                <span>Start Casting</span>
              </>
            )}
          </button>
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            className="p-2 rounded-full hover:bg-gray-700"
          >
            <List size={20} />
          </button>
          <button
            onClick={() => setShowDirectoryModal(true)}
            className="flex items-center space-x-1 bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded"
          >
            <Plus size={16} />
            <span>Add Directory</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content area */}
        <div
          className={`flex-1 p-4 flex flex-col ${
            showPlaylist ? "w-2/3" : "w-full"
          }`}
        >
          <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
            {currentItem && currentItem.type === "video" ? (
              <video
                ref={mediaRef}
                src={currentItem.path}
                className="max-h-full max-w-full"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleMediaEnded}
              />
            ) : currentItem && currentItem.type === "image" ? (
              <img
                src={currentItem.path}
                alt={currentItem.name}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-gray-500">No media selected</div>
            )}
          </div>

          {/* Media controls */}
          <div className="mt-4 bg-gray-800 p-4 rounded-lg">
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
        </div>

        {/* Playlist sidebar */}
        {showPlaylist && (
          <div className="w-1/3 bg-gray-800 p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Playlist</h2>
              <span className="text-sm text-gray-400">
                {playlist.length} items
              </span>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Directories
              </h3>
              <ul className="space-y-1">
                {directories.map((dir) => (
                  <li
                    key={dir.id}
                    className="text-sm bg-gray-700 px-3 py-2 rounded flex justify-between items-center"
                  >
                    <span>{dir.name}</span>
                    <button
                      onClick={() => removeDirectory(dir.id)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
                {directories.length === 0 && (
                  <li className="text-sm text-gray-500 italic">
                    No directories added
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Media Files
              </h3>
              <ul className="space-y-1">
                {playlist.map((item, index) => (
                  <li
                    key={item.id}
                    className={`px-3 py-2 rounded flex justify-between items-center ${
                      index === currentIndex
                        ? "bg-teal-900"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                    onClick={() => playMedia(index)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        {index === currentIndex && isPlaying && (
                          <div className="w-2 h-2 bg-teal-400 rounded-full"></div>
                        )}
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.size && (
                        <div className="text-xs text-gray-400 mt-1">
                          {item.type} • {formatFileSize(item.size)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromPlaylist(item.id);
                      }}
                      className="text-gray-400 hover:text-white ml-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
                {playlist.length === 0 && (
                  <li className="text-sm text-gray-500 italic">
                    Playlist is empty
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Directory Selection Modal */}
      <DirectorySelectionModal
        isOpen={showDirectoryModal}
        onClose={() => setShowDirectoryModal(false)}
        onAddDirectory={addDirectory}
      />
    </div>
  );
}

// Player component - minimal UI for displaying media
function Player() {
  const [currentItem, setCurrentItem] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isCasting, setIsCasting] = useState(false);

  const mediaRef = useRef(null);

  // Effect to handle socket events from Caster
  useEffect(() => {
    socket.on("casting_state", (data) => {
      setIsCasting(data.isCasting);

      if (data.isCasting) {
        // Update all state if casting is active
        if (data.currentItem) setCurrentItem(data.currentItem);
        if (data.isPlaying !== undefined) setIsPlaying(data.isPlaying);
        if (data.currentTime !== undefined) setCurrentTime(data.currentTime);
        if (data.volume !== undefined) setVolume(data.volume);
      } else {
        // Reset state if casting is stopped
        setCurrentItem(null);
        setIsPlaying(false);
        setCurrentTime(0);
      }
    });

    socket.on("media_change", (data) => {
      setCurrentItem(data.item);
      setIsPlaying(data.isPlaying);
    });
    
    socket.on("playback_state", (data) => {
      setIsPlaying(data.isPlaying);
    });

    socket.on("time_update", (data) => {
      setCurrentTime(data.currentTime);
      if (mediaRef.current) {
        mediaRef.current.currentTime = data.currentTime;
      }
    });

    socket.on("volume_change", (data) => {
      setVolume(data.volume);
      if (mediaRef.current) {
        mediaRef.current.volume = data.volume;
      }
    });

    // Request current state when connecting
    socket.emit("request_state");

    return () => {
      socket.off("casting_state");
      socket.off("media_change");
      socket.off("playback_state");
      socket.off("time_update");
      socket.off("volume_change");
    };
  }, []);

  // Effect to sync media playback state
  useEffect(() => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current
          .play()
          .catch((e) => console.error("Playback error:", e));
      } else {
        mediaRef.current.pause();
      }
    }
  }, [isPlaying, currentItem]);

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden">
      {isCasting ? (
        currentItem && currentItem.type === "video" ? (
          <video
            ref={mediaRef}
            src={currentItem.path}
            className="max-h-full max-w-full"
            playsInline
          />
        ) : currentItem && currentItem.type === "image" ? (
          <img
            src={currentItem.path}
            alt={currentItem.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="text-gray-500">Waiting for media...</div>
        )
      ) : (
        <div className="text-center p-8">
          <div className="text-4xl text-gray-500 mb-4">Waiting for Cast</div>
          <p className="text-gray-400">
            The caster needs to press "Start Casting" to begin streaming content
            to this player.
          </p>
        </div>
      )}
    </div>
  );
}
