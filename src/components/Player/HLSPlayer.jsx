import React, { useState, useEffect, useRef, useCallback } from "react";
import Hls from 'hls.js';
import socket, { requestState, joinSession } from "../../services/socketService";

export default function HLSPlayer() {
  const [currentItem, setCurrentItem] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isCasting, setIsCasting] = useState(false);
  const [networkState, setNetworkState] = useState('idle');
  const mediaRef = useRef(null);
  const hlsRef = useRef(null);

  // Initialize HLS
  const initializeHLS = useCallback((videoElement, src) => {
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        startLevel: -1,
        startFragPrefetch: true,
        testBandwidth: true,
        progressive: true,
        lowLatencyMode: true,
      });

      hls.loadSource(src);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed');
        videoElement.play().catch(error => {
          console.error('Auto-play failed:', error);
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal error, destroying HLS instance');
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
      return hls;
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // For Safari, which has native HLS support
      videoElement.src = src;
      return null;
    }
  }, []);

  // Cleanup HLS
  const cleanupHLS = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // Check URL for session ID on initial load
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get('session');
    
    console.log("HLS Player detected session ID:", sessionId);
    
    if (sessionId) {
      joinSession(sessionId);
    } else {
      requestState();
    }
  }, []);

  // Effect to handle socket events from Caster
  useEffect(() => {
    const castingStateHandler = (data) => {
      console.log("Received casting state:", data);
      setIsCasting(data.isCasting);

      if (data.isCasting) {
        if (data.currentItem) {
          console.log("Setting current item:", data.currentItem);
          setCurrentItem(data.currentItem);
          
          // Initialize HLS when we get a new item
          if (mediaRef.current && data.currentItem.hlsUrl) {
            cleanupHLS();
            initializeHLS(mediaRef.current, data.currentItem.hlsUrl);
          }
        }
        if (data.isPlaying !== undefined) setIsPlaying(data.isPlaying);
        if (data.volume !== undefined) setVolume(data.volume);
      } else {
        setCurrentItem(null);
        setIsPlaying(false);
        cleanupHLS();
      }
    };

    const mediaChangeHandler = (data) => {
      console.log("Media changed:", data);
      setCurrentItem(data.item);
      setIsPlaying(data.isPlaying);
      
      // Initialize HLS for new media
      if (mediaRef.current && data.item.hlsUrl) {
        cleanupHLS();
        initializeHLS(mediaRef.current, data.item.hlsUrl);
      }
    };

    const playbackStateHandler = (data) => {
      console.log("Playback state changed:", data.isPlaying);
      setIsPlaying(data.isPlaying);
      
      if (mediaRef.current) {
        if (data.isPlaying) {
          mediaRef.current.play().catch(console.error);
        } else {
          mediaRef.current.pause();
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
    socket.on("volume_change", volumeChangeHandler);

    // Cleanup function
    return () => {
      socket.off("casting_state", castingStateHandler);
      socket.off("media_change", mediaChangeHandler);
      socket.off("playback_state", playbackStateHandler);
      socket.off("volume_change", volumeChangeHandler);
      cleanupHLS();
    };
  }, [initializeHLS, cleanupHLS]);

  // Effect to sync media playback state
  useEffect(() => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.play().catch(error => {
          console.error("Playback error:", error);
          setNetworkState('error');
        });
      } else {
        mediaRef.current.pause();
      }
    }
  }, [isPlaying]);

  return (
    <div className="h-screen w-screen bg-black flex flex-col relative">
      {isCasting && currentItem && (
        <div className="absolute top-2 right-2 z-10 bg-black/50 text-white p-2 rounded">
          {networkState === 'error' && (
            <span className="text-red-500">Playback Error</span>
          )}
          {networkState === 'playing' && 'Playing'}
          {networkState === 'paused' && 'Paused'}
        </div>
      )}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {isCasting && currentItem && currentItem.type === "video" && (
          <video
            ref={mediaRef}
            className="max-h-full max-w-full"
            playsInline
            muted={false}
            volume={volume}
            onError={(e) => {
              console.error("Video error:", e);
              setNetworkState('error');
            }}
            onPlaying={() => setNetworkState('playing')}
            onPause={() => setNetworkState('paused')}
            onWaiting={() => setNetworkState('buffering')}
            onCanPlay={() => setNetworkState('ready')}
          />
        )}
      </div>
    </div>
  );
}
