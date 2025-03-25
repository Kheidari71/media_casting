import React, { useState, useEffect, useRef, useCallback } from "react";
import socket, { requestState, joinSession } from "../../services/socketService";

// Player component - minimal UI for displaying media
export default function Player() {
  const [currentItem, setCurrentItem] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isCasting, setIsCasting] = useState(false);
  const mediaRef = useRef(null);
  const [bufferingProgress, setBufferingProgress] = useState(0);
  const [networkState, setNetworkState] = useState('idle');
  const lastPlaybackStateRef = useRef({ playing: false, time: 0 });

  const handleMediaEvents = useCallback(() => {
    if (!mediaRef.current) return;

    const video = mediaRef.current;

    const waitingHandler = () => {
      setNetworkState('buffering');
      console.log('Video is waiting, buffering...');
    };

    const canPlayHandler = () => {
      setNetworkState('ready');
      console.log('Video is ready to play');
    };

    const progressHandler = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const duration = video.duration;
        const progress = duration > 0 
          ? (bufferedEnd / duration) * 100 
          : 0;
        setBufferingProgress(progress);
      }
    };

    const errorHandler = (e) => {
      console.error('Video playback error:', e);
      setNetworkState('error');
    };

    video.addEventListener('waiting', waitingHandler);
    video.addEventListener('canplay', canPlayHandler);
    video.addEventListener('progress', progressHandler);
    video.addEventListener('error', errorHandler);

    return () => {
      video.removeEventListener('waiting', waitingHandler);
      video.removeEventListener('canplay', canPlayHandler);
      video.removeEventListener('progress', progressHandler);
      video.removeEventListener('error', errorHandler);
    };
  }, []);

  useEffect(() => {
    if (mediaRef.current && currentItem) {
      const cleanup = handleMediaEvents();
      return cleanup;
    }
  }, [currentItem, handleMediaEvents]);

  // Check URL for session ID on initial load
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get('session');
    
    console.log("Player detected session ID:", sessionId);
    
    if (sessionId) {
      joinSession(sessionId);
    } else {
      requestState();
    }
  }, []);

  // Advanced time synchronization
  const synchronizeTime = useCallback((data) => {
    if (!mediaRef.current) return;

    const video = mediaRef.current;
    const { currentTime, timestamp, isSeeking } = data;

    // Calculate network delay
    const networkDelay = Date.now() - timestamp;
    const adjustedTime = currentTime + (networkDelay / 1000);

    try {
      // Always sync for seeking events
      if (isSeeking) {
        video.currentTime = adjustedTime;
        return;
      }

      // For regular time updates, check if we're too far out of sync
      const timeDifference = Math.abs(video.currentTime - adjustedTime);
      
      if (timeDifference > 0.5) { // Reduced threshold for more frequent syncs
        video.currentTime = adjustedTime;
        console.log(`Synchronized video. Time difference: ${timeDifference.toFixed(2)} seconds`);
      }
    } catch (error) {
      console.error('Time synchronization error:', error);
      setNetworkState('error');
    }
  }, []);

  // Effect to handle socket events from Caster
  useEffect(() => {
    const castingStateHandler = (data) => {
      console.log("Received casting state:", data);
      setIsCasting(data.isCasting);

      if (data.isCasting) {
        // Update all state if casting is active
        if (data.currentItem) {
          console.log("Setting current item:", data.currentItem);
          setCurrentItem(data.currentItem);
        }
        if (data.isPlaying !== undefined) setIsPlaying(data.isPlaying);
        if (data.volume !== undefined) setVolume(data.volume);

        // Handle initial time position with validation
        if (data.currentTime !== undefined && mediaRef.current) {
          const time = Number(data.currentTime);
          if (!isNaN(time) && isFinite(time) && time >= 0) {
            console.log("Setting initial time position:", time);
            mediaRef.current.currentTime = time;
          } else {
            console.warn("Invalid currentTime value received:", data.currentTime);
          }
        }
      } else {
        // Reset state if casting is stopped
        setCurrentItem(null);
        setIsPlaying(false);
      }
    };

    const mediaChangeHandler = (data) => {
      console.log("Media changed:", data);
      setCurrentItem(data.item);
      setIsPlaying(data.isPlaying);
    };

    const playbackStateHandler = (data) => {
      console.log("Playback state changed:", data.isPlaying);
      setIsPlaying(data.isPlaying);
    };

    const timeUpdateHandler = (data) => {
      // More robust time synchronization
      synchronizeTime(data);
    };

    const seekHandler = (data) => {
      console.log("Seek event received:", data);
      if (mediaRef.current) {
        const time = Number(data.targetTime);
        if (!isNaN(time) && isFinite(time) && time >= 0) {
          mediaRef.current.currentTime = time;
          console.log("Seek completed, new time:", time);
        } else {
          console.warn("Invalid seek time received:", data.targetTime);
        }
      }
    };

    const volumeChangeHandler = (data) => {
      console.log("Volume changed:", data.volume);
      setVolume(data.volume);
      if (mediaRef.current) {
        mediaRef.current.volume = data.volume;
      }
    };

    // Attach event listeners
    socket.on("casting_state", castingStateHandler);
    socket.on("media_change", mediaChangeHandler);
    socket.on("playback_state", playbackStateHandler);
    socket.on("time_update", timeUpdateHandler);
    socket.on("seek", seekHandler);
    socket.on("volume_change", volumeChangeHandler);

    // Cleanup function
    return () => {
      socket.off("casting_state", castingStateHandler);
      socket.off("media_change", mediaChangeHandler);
      socket.off("playback_state", playbackStateHandler);
      socket.off("time_update", timeUpdateHandler);
      socket.off("seek", seekHandler);
      socket.off("volume_change", volumeChangeHandler);
    };
  }, [synchronizeTime]);

  // Effect to sync media playback state
  useEffect(() => {
    if (mediaRef.current && currentItem) {
      const video = mediaRef.current;
      
      const playVideo = () => {
        video.play()
          .then(() => {
            console.log("Playback started successfully");
            setNetworkState('playing');
            lastPlaybackStateRef.current = { 
              playing: true, 
              time: video.currentTime 
            };
          })
          .catch((e) => {
            console.error("Playback error:", e);
            setNetworkState('error');
            
            // Attempt recovery
            if (e.name === 'NotAllowedError') {
              // Likely autoplay prevention
              video.muted = true;
              video.play().catch(console.error);
            }
          });
      };

      const pauseVideo = () => {
        video.pause();
        setNetworkState('paused');
        lastPlaybackStateRef.current = { 
          playing: false, 
          time: video.currentTime 
        };
      };

      if (isPlaying) {
        console.log("Attempting to play video...");
        playVideo();
      } else {
        pauseVideo();
      }
    }
  }, [isPlaying, currentItem]);

  return (
    <div className="h-screen w-screen bg-black flex flex-col relative overflow-hidden">
      {isCasting && currentItem && (
        <div className="absolute top-2 right-2 z-10 bg-black/50 text-white p-2 rounded">
          {networkState === 'buffering' && (
            `Buffering: ${bufferingProgress.toFixed(0)}%`
          )}
          {networkState === 'error' && (
            <span className="text-red-500">Playback Error</span>
          )}
          {networkState === 'playing' && 'Playing'}
          {networkState === 'paused' && 'Paused'}
        </div>
      )}
      <div className="flex-1 flex items-center justify-center w-full h-full">
        {isCasting && currentItem ? (
          currentItem.type === "video" ? (
            <video
              ref={mediaRef}
              src={currentItem.path}
              className="w-full h-full object-contain"
              preload="auto"
              playsInline
              muted={false}
              volume={volume}
              onError={(e) => {
                console.error("Video error:", e);
                setNetworkState('error');
              }}
              buffered
              disablePictureInPicture
              controlsList="nodownload noplaybackrate"
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault();
                }
              }}
            />
          ) : currentItem.type === "image" ? (
            <img
              src={currentItem.path}
              alt={currentItem.name}
              className="w-full h-full object-contain"
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
            />
          ) : null
        ) : (
          <div className="text-center text-white">
            <div className="text-2xl font-semibold mb-2">
              {networkState === 'error' ? 'Connection Error' : 'Waiting for Cast...'}
            </div>
            <div className="text-gray-400">
              {networkState === 'error' 
                ? 'Please check your connection and try again'
                : 'The caster will start sharing media soon'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}