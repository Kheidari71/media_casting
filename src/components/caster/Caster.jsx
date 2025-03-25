import React, { useState, useEffect, useRef } from "react";
import { List, Plus, Cast, Square } from "lucide-react";


import socket, {
  emitCastingState,
  emitMediaChange,
  emitPlaybackState,
  emitTimeUpdate,
  emitVolumeChange,
  emitPlaylistUpdate,
  getSocketId
} from "../../services/socketService";
import MediaControls from "./MediaControls";
import PlaylistSidebar from "./PlaylistSidebar";
import DirectoryModal from "./DirectoryModal";

// Caster component - full-featured media player and playlist management
export default function Caster() {
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
  const [activeDirectory, setActiveDirectory] = useState(null);
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [isCasting, setIsCasting] = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [sessionUrl, setSessionUrl] = useState("");
  const [isDatabasePlaylist, setIsDatabasePlaylist] = useState(false);

  const mediaRef = useRef(null);

  // Function to add a directory and its media files
  const addDirectory = (directoryName, mediaItems) => {
    if (!directoryName || mediaItems.length === 0) return;

    // Create directory/category with its media items
    const directoryId = Date.now();
    const newDirectory = { 
      id: directoryId, 
      name: directoryName,
      items: mediaItems.map(item => ({ ...item, directoryId }))
    };
    
    // Add the directory to the list
    setDirectories([...directories, newDirectory]);

    // Add the media items to the playlist with directory ID
    const newPlaylist = [...playlist, ...newDirectory.items];
    setPlaylist(newPlaylist);

    // Set this as the active directory
    setActiveDirectory(directoryId);

    // Notify player about playlist update if casting
    if (isCasting) {
      emitPlaylistUpdate(newPlaylist);
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

    // Remove all media items that belong to this directory
    const newPlaylist = playlist.filter((item) => item.directoryId !== dirId);
    setPlaylist(newPlaylist);

    // Update player if casting
    if (isCasting) {
      emitPlaylistUpdate(newPlaylist);
    }

    // If we removed the active directory, set active to null
    if (activeDirectory === dirId) {
      setActiveDirectory(null);
    }

    // If we removed the current playing item's directory, adjust currentIndex
    if (currentIndex >= newPlaylist.length) {
      setCurrentIndex(Math.max(0, newPlaylist.length - 1));
    }
  };

  // Function to toggle directory view
  const toggleDirectoryView = (dirId) => {
    if (activeDirectory === dirId) {
      // If clicking the already active directory, close it
      setActiveDirectory(null);
    } else {
      // Otherwise, set this directory as active
      setActiveDirectory(dirId);
    }
  };

  const removeFromPlaylist = (id) => {
    const newPlaylist = playlist.filter((item) => item.id !== id);
    setPlaylist(newPlaylist);

    if (isCasting) {
      emitPlaylistUpdate(newPlaylist);
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
      emitMediaChange({
        index,
        item: playlist[index],
        isPlaying: true,
      });
    }
  };

  const togglePlay = () => {
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);

    if (isCasting) {
      emitPlaybackState({ isPlaying: newPlayingState });
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
      emitVolumeChange({ volume: newVolume });
    }
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      const currentTime = mediaRef.current.currentTime;
      setCurrentTime(currentTime);

      if (isCasting) {
        emitTimeUpdate({
          currentTime,
          timestamp: Date.now(),
          isSeeking: false
        });
      }
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    
    if (mediaRef.current) {
      // Set the new time
      mediaRef.current.currentTime = newTime;
      
      // If we were playing, resume playback
      if (isPlaying) {
        mediaRef.current.play().catch(console.error);
      }
    }

    if (isCasting) {
      // Send seek event
      socket.emit('seek', {
        targetTime: newTime,
        timestamp: Date.now()
      });

      // Send immediate time update with seeking flag
      emitTimeUpdate({ 
        currentTime: newTime,
        timestamp: Date.now(),
        isSeeking: true
      });
    }
  };

  const toggleAutoplay = () => {
    const newAutoplay = !autoplay;
    setAutoplay(newAutoplay);
    localStorage.setItem("autoplay", newAutoplay.toString());
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
  
    // Generate a session URL when starting to cast
    if (newCastingState) {
      const socketId = getSocketId();
      console.log("Starting cast with socket ID:", socketId);
      // Use your actual IP address instead of window.location.origin
      const baseUrl = "http://192.168.0.161:3000";
      const newSessionUrl = `${baseUrl}/player?session=${socketId}`;
      setSessionUrl(newSessionUrl);

      // If we have a video playing, send an immediate time update
      if (mediaRef.current && isPlaying) {
        emitTimeUpdate({
          currentTime: mediaRef.current.currentTime,
          timestamp: Date.now(),
          isSeeking: true
        });
      }
    } else {
      setSessionUrl("");
    }

    // Notify player about casting state
    const castingData = {
      isCasting: newCastingState,
      // If starting to cast, send current state
      ...(newCastingState && {
        playlist,
        currentIndex,
        currentItem: playlist[currentIndex] || null,
        isPlaying,
        currentTime: mediaRef.current ? mediaRef.current.currentTime : 0,
        volume,
        autoplay,
      })
    };
  
    console.log("Emitting casting state:", castingData);
    emitCastingState(castingData);
  };

  // Handle media ended event
  const handleMediaEnded = () => {
    if (autoplay && playlist.length > 0) {
      handleNext();
    } else {
      setIsPlaying(false);

      if (isCasting) {
        emitPlaybackState({ isPlaying: false });
      }
    }
  };

  // Effect to handle socket events from Player
  useEffect(() => {
    console.log("Setting up request_state listener");
    
    socket.on("request_state", () => {
      console.log("Received request_state, isCasting:", isCasting);
      if (isCasting) {
        // Send current state to player
        const stateData = {
          isCasting: true,
          playlist,
          currentIndex,
          currentItem: playlist[currentIndex] || null,
          isPlaying,
          currentTime,
          volume,
          autoplay,
        };
        console.log("Sending state in response:", stateData);
        emitCastingState(stateData);
      }
    });

    return () => {
      console.log("Cleaning up request_state listener");
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
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-teal-400">Media Caster</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            {isCasting && (
              <div className="mr-4 bg-gray-700 px-3 py-1 rounded flex items-center">
                <span className="text-sm text-gray-300 mr-2">Session URL:</span>
                <input
                  type="text"
                  value={sessionUrl}
                  readOnly
                  className="bg-gray-800 text-xs text-gray-300 px-2 py-1 rounded w-48"
                  onClick={(e) => e.target.select()}
                />
              </div>
            )}
            <div className="flex items-center space-x-2 mr-4">
              <span className="text-sm text-gray-300">Playlist Source:</span>
              <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2">
                <span
                  className={`${
                    isDatabasePlaylist ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
                <button
                  onClick={() => setIsDatabasePlaylist(!isDatabasePlaylist)}
                  className="absolute inset-0 w-full h-full rounded-full"
                >
                  <span className="sr-only">Switch playlist source</span>
                </button>
              </div>
              <span className="text-sm text-gray-300">
                {isDatabasePlaylist ? "Database" : "Local"}
              </span>
            </div>
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
          </div>
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
            {isCasting && currentItem ? (
              currentItem.type === "video" ? (
                <video
                  ref={mediaRef}
                  src={currentItem.path}
                  className="max-h-full max-w-full"
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleMediaEnded}
                />
              ) : currentItem.type === "image" ? (
                <img
                  src={currentItem.path}
                  alt={currentItem.name}
                  className="max-h-full max-w-full object-contain"
                />
              ) : null
            ) : (
              <div>Waiting for Cast...</div>
            )}
          </div>

          {/* Media controls */}
          <MediaControls 
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            autoplay={autoplay}
            handlePrevious={handlePrevious}
            handleNext={handleNext}
            togglePlay={togglePlay}
            handleSeek={handleSeek}
            handleVolumeChange={handleVolumeChange}
            toggleAutoplay={toggleAutoplay}
            handleFullscreen={handleFullscreen}
          />
        </div>

        {/* Playlist sidebar */}
        {showPlaylist && (
          <PlaylistSidebar 
            directories={directories}
            playlist={playlist}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            activeDirectory={activeDirectory}
            toggleDirectoryView={toggleDirectoryView}
            removeDirectory={removeDirectory}
            removeFromPlaylist={removeFromPlaylist}
            playMedia={playMedia}
            isDatabasePlaylist={isDatabasePlaylist}
          />
        )}
      </div>

      {/* Directory Selection Modal */}
      <DirectoryModal
        isOpen={showDirectoryModal}
        onClose={() => setShowDirectoryModal(false)}
        onAddDirectory={addDirectory}
        isDatabasePlaylist={isDatabasePlaylist}
      />
    </div>
  );
}

