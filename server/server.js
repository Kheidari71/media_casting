const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { startHLSStream, stopHLSStream, getMediaType } = require('./hlsServer');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Create upload directory 
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use a unique filename to avoid conflicts
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + 
                     path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

// Enable CORS
app.use(cors());

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'build')));

// Serve uploaded files
app.use('/media', (req, res, next) => {
  try {
    const filePath = path.join(uploadDir, req.url);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream'; // default
    
    if (ext === '.mp4' || ext === '.mov') contentType = 'video/mp4';
    else if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    
    if (range && (ext === '.mp4' || ext === '.webm' || ext === '.mov')) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, {start, end});
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });
      
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('Error serving media:', err);
    next(err);
  }
});

// Handle file uploads
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  const mediaType = getMediaType(req.file.path);
  if (!mediaType) {
    return res.status(400).send('Unsupported media type');
  }

  // Return the URL that can be used to access the file
  const fileUrl = `http://192.168.0.161:5000/media/${req.file.filename}`;
  res.json({ 
    url: fileUrl,
    type: mediaType
  });
});

// Create Socket.io server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins in development
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000, // Increase ping timeout
  pingInterval: 25000, // Adjust ping interval
  connectTimeout: 45000 // Connection timeout
});

// Store active casting sessions and their HLS streams
const castingSessions = new Map();
const activeStreams = new Map();

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  // Handle requests for current state
  socket.on('request_state', () => {
    try {
      const roomID = Array.from(socket.rooms).find(room => room !== socket.id);
      
      if (roomID && castingSessions.has(roomID)) {
        socket.emit('casting_state', castingSessions.get(roomID));
      }
    } catch (error) {
      console.error('Error handling request_state:', error);
      socket.emit('error', { message: 'Failed to get state' });
    }
  });

  // Handle casting state changes
  socket.on('casting_state', (data) => {
    try {
      console.log('Casting state update:', data.isCasting ? 'Started' : 'Stopped');
      
      if (data.isCasting) {
        const roomID = `room_${socket.id}`;
        socket.join(roomID);
        
        // Start HLS stream if it's a video
        if (data.currentItem && data.currentItem.url) {
          const mediaType = getMediaType(data.currentItem.url);
          if (mediaType === 'video') {
            try {
              const stream = startHLSStream(data.currentItem.url, roomID);
              activeStreams.set(roomID, stream);
              data.currentItem.streamUrl = stream.url;
            } catch (error) {
              console.error('Error starting HLS stream:', error);
              socket.emit('error', { message: 'Failed to start video stream' });
              return;
            }
          }
        }
        
        castingSessions.set(roomID, data);
        socket.to(roomID).emit('casting_state', data);
      } else {
        const roomID = Array.from(socket.rooms).find(room => room !== socket.id);
        
        if (roomID) {
          // Stop HLS stream if it exists
          if (activeStreams.has(roomID)) {
            try {
              stopHLSStream(activeStreams.get(roomID));
              activeStreams.delete(roomID);
            } catch (error) {
              console.error('Error stopping HLS stream:', error);
            }
          }
          
          socket.to(roomID).emit('casting_state', { isCasting: false });
          castingSessions.delete(roomID);
          socket.leave(roomID);
        }
      }
    } catch (error) {
      console.error('Error handling casting_state:', error);
      socket.emit('error', { message: 'Failed to update casting state' });
    }
  });

  // Handle media change events
  socket.on('media_change', (data) => {
    try {
      const roomID = Array.from(socket.rooms).find(room => room !== socket.id);
      
      if (roomID) {
        // Stop previous stream if it exists
        if (activeStreams.has(roomID)) {
          try {
            stopHLSStream(activeStreams.get(roomID));
            activeStreams.delete(roomID);
          } catch (error) {
            console.error('Error stopping previous stream:', error);
          }
        }

        // Start new stream if it's a video
        if (data.currentItem && data.currentItem.url) {
          const mediaType = getMediaType(data.currentItem.url);
          if (mediaType === 'video') {
            try {
              const stream = startHLSStream(data.currentItem.url, roomID);
              activeStreams.set(roomID, stream);
              data.currentItem.streamUrl = stream.url;
            } catch (error) {
              console.error('Error starting new stream:', error);
              socket.emit('error', { message: 'Failed to start new video stream' });
              return;
            }
          }
        }

        if (castingSessions.has(roomID)) {
          const currentState = castingSessions.get(roomID);
          castingSessions.set(roomID, { ...currentState, ...data });
        }
        
        socket.to(roomID).emit('media_change', data);
      }
    } catch (error) {
      console.error('Error handling media_change:', error);
      socket.emit('error', { message: 'Failed to update media' });
    }
  });

  // Handle playback state changes
  socket.on('playback_state', (data) => {
    const roomID = Array.from(socket.rooms).find(room => room !== socket.id);
    
    if (roomID) {
      // More comprehensive session state update
      if (castingSessions.has(roomID)) {
        const currentState = castingSessions.get(roomID);
        const updatedState = {
          ...currentState,
          isPlaying: data.isPlaying,
          lastPlaybackChange: Date.now(), // Add timestamp of last change
          playbackChangedBy: socket.id // Track which client initiated the change
        };
  
        // Optional: Add more context about playback state
        if (data.currentTime !== undefined) {
          updatedState.currentTime = data.currentTime;
        }
  
        // Update the session state
        castingSessions.set(roomID, updatedState);
        
        // Log the playback state change for debugging
        console.log(`Playback state changed in room ${roomID}:`, {
          playing: data.isPlaying,
          timestamp: updatedState.lastPlaybackChange
        });
      }
      
      // Broadcast to all clients in the room except the sender
      socket.to(roomID).emit('playback_state', {
        ...data,
        timestamp: Date.now(), // Add server timestamp for sync
        sourceSocketId: socket.id // Optionally track source of change
      });
    }
  });

  // Handle time updates
  socket.on('time_update', (data) => {
    const roomID = Array.from(socket.rooms).find(room => room !== socket.id);
    
    if (roomID) {
      // Update session state
      if (castingSessions.has(roomID)) {
        const currentState = castingSessions.get(roomID);
        const updatedState = {
          ...currentState,
          currentTime: data.currentTime,
          lastTimeUpdate: Date.now()
        };
        castingSessions.set(roomID, updatedState);
      }
      
      // Broadcast to all clients in the room except the sender
      socket.to(roomID).emit('time_update', {
        ...data,
        timestamp: Date.now(),
        sourceSocketId: socket.id
      });
    }
  });

  // Handle seek events
  socket.on('seek', (data) => {
    const roomID = Array.from(socket.rooms).find(room => room !== socket.id);
    
    if (roomID) {
      // Update session state
      if (castingSessions.has(roomID)) {
        const currentState = castingSessions.get(roomID);
        const updatedState = {
          ...currentState,
          currentTime: data.targetTime,
          lastSeek: Date.now(),
          isSeeking: true
        };
        castingSessions.set(roomID, updatedState);
      }
      
      // Broadcast seek event to all clients in the room except the sender
      socket.to(roomID).emit('seek', {
        targetTime: data.targetTime,
        timestamp: Date.now(),
        sourceSocketId: socket.id
      });
    }
  });

  // Handle seek complete events
  socket.on('seek_complete', (data) => {
    const roomID = Array.from(socket.rooms).find(room => room !== socket.id);
    
    if (roomID) {
      // Update session state
      if (castingSessions.has(roomID)) {
        const currentState = castingSessions.get(roomID);
        const updatedState = {
          ...currentState,
          currentTime: data.currentTime,
          lastSeekComplete: Date.now(),
          isSeeking: false
        };
        castingSessions.set(roomID, updatedState);
      }
      
      // Broadcast seek complete event to all clients in the room except the sender
      socket.to(roomID).emit('seek_complete', {
        currentTime: data.currentTime,
        timestamp: Date.now(),
        sourceSocketId: socket.id
      });
    }
  });

  // Handle volume changes
  socket.on('volume_change', (data) => {
    const roomID = Array.from(socket.rooms).find(room => room !== socket.id);
    
    if (roomID) {
      // Update session state
      if (castingSessions.has(roomID)) {
        const currentState = castingSessions.get(roomID);
        castingSessions.set(roomID, { ...currentState, volume: data.volume });
      }
      
      // Broadcast to all clients in the room except the sender
      socket.to(roomID).emit('volume_change', data);
    }
  });

  // Handle autoplay changes
  socket.on('autoplay_change', (data) => {
    const roomID = Array.from(socket.rooms).find(room => room !== socket.id);
    
    if (roomID) {
      // Update session state
      if (castingSessions.has(roomID)) {
        const currentState = castingSessions.get(roomID);
        castingSessions.set(roomID, { ...currentState, autoplay: data.autoplay });
      }
      
      // Broadcast to all clients in the room except the sender
      socket.to(roomID).emit('autoplay_change', data);
    }
  });

  // Handle playlist updates
  socket.on('playlist_update', (data) => {
    const roomID = Array.from(socket.rooms).find(room => room !== socket.id);
    
    if (roomID) {
      // Update session state
      if (castingSessions.has(roomID)) {
        const currentState = castingSessions.get(roomID);
        castingSessions.set(roomID, { ...currentState, playlist: data });
      }
      
      // Broadcast to all clients in the room except the sender
      socket.to(roomID).emit('playlist_update', data);
    }
  });

  // Handle client joining a specific casting session
  socket.on('join_session', (sessionId) => {
    // The player wants to join a specific caster's session
    const roomID = `room_${sessionId}`;

    console.log(`Looking for room: ${roomID}`);
    // Join the room
    socket.join(roomID);
    
    // If session exists, send state to the player
    if (castingSessions.has(roomID)) {
        console.log(`Found session, sending state to player ${socket.id}`);
      socket.emit('casting_state', castingSessions.get(roomID));
    } else {
        console.log(`No session found for room ${roomID}`);
      socket.emit('casting_state', { isCasting: false });
    }
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    for (const [roomID, sessionData] of castingSessions.entries()) {
      if (roomID === `room_${socket.id}`) {
        // Stop HLS stream if it exists
        if (activeStreams.has(roomID)) {
          stopHLSStream(activeStreams.get(roomID));
          activeStreams.delete(roomID);
        }
        
        io.to(roomID).emit('casting_state', { isCasting: false });
        castingSessions.delete(roomID);
        break;
      }
    }
  });
});

// Test route with direct HTML response
app.get('/test', (req, res) => {
  res.send('<html><body><h1>Server is working!</h1><p>If you can see this, the connection is successful.</p></body></html>');
});

// Catch-all route to serve the React app for any other requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});

  