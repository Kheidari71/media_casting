import { io } from "socket.io-client";

// Create socket connection - point to our local server in development
const SOCKET_URL = 'http://192.168.0.161:5000';

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: true,
});

// Log connection status
socket.on('connect', () => {
  console.log('Socket connected with ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Log when casting state is received
socket.on('casting_state', (data) => {
  console.log('Received casting state:', data);
});

// Caster event emitters
export const emitCastingState = (castingState) => {
  console.log('Emitting casting state:', castingState);
  socket.emit("casting_state", castingState);
};

export const emitMediaChange = (mediaData) => {
  console.log('Emitting media change:', mediaData);
  socket.emit("media_change", mediaData);
};

export const emitPlaybackState = (playbackState) => {
  console.log('Emitting playback state:', playbackState);
  socket.emit("playback_state", playbackState);
};

export const emitTimeUpdate = (currentTime) => {
  socket.emit("time_update", { 
    currentTime, 
    timestamp: Date.now() 
  });
};

export const emitVolumeChange = (volumeData) => {
  console.log('Emitting volume change:', volumeData);
  socket.emit("volume_change", volumeData);
};

export const emitAutoplayChange = (autoplayData) => {
  console.log('Emitting autoplay change:', autoplayData);
  socket.emit("autoplay_change", autoplayData);
};

export const emitPlaylistUpdate = (playlist) => {
  console.log('Emitting playlist update, length:', playlist.length);
  socket.emit("playlist_update", playlist);
};

export const requestState = () => {
  console.log('Requesting current state');
  socket.emit("request_state");
};

// Join a specific casting session
export const joinSession = (sessionId) => {
  console.log('Attempting to join session:', sessionId);
  socket.emit("join_session", sessionId);
};

// Get the current socket ID (useful for sharing session links)
export const getSocketId = () => {
  console.log('Getting socket ID:', socket.id);
  return socket.id;
};

export default socket;