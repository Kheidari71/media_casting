const NodeMediaServer = require('node-media-server');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Create HLS output directory if it doesn't exist
const hlsOutputDir = path.join(__dirname, 'uploads', 'hls');
if (!fs.existsSync(hlsOutputDir)) {
  fs.mkdirSync(hlsOutputDir, { recursive: true });
}

// Initialize Node Media Server with improved configuration
const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*',
    mediaroot: hlsOutputDir,
    webroot: path.join(__dirname, 'public')
  },
  trans: {
    ffmpeg: ffmpegInstaller.path,
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        hlsKeep: true,
        dash: false,
        dashFlags: '[f=dash:window_size=3:extra_window_size=5]'
      }
    ]
  },
  logType: 3, // Enable detailed logging
  logFile: path.join(__dirname, 'logs', 'nms.log')
};

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const nms = new NodeMediaServer(config);
nms.run();

// Function to determine media type
const getMediaType = (filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (['.mp4', '.mov', '.webm'].includes(ext)) {
      return 'video';
    } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      return 'image';
    }
    return null;
  } catch (error) {
    console.error('Error determining media type:', error);
    return null;
  }
};

// Function to clean up old HLS files
const cleanupOldHLSFiles = (outputPath) => {
  try {
    if (fs.existsSync(outputPath)) {
      const files = fs.readdirSync(outputPath);
      const now = Date.now();
      files.forEach(file => {
        const filePath = path.join(outputPath, file);
        const stats = fs.statSync(filePath);
        // Remove files older than 1 hour
        if (now - stats.mtime.getTime() > 3600000) {
          fs.unlinkSync(filePath);
        }
      });
    }
  } catch (error) {
    console.error('Error cleaning up HLS files:', error);
  }
};

// Function to start HLS streaming for a video file
const startHLSStream = (inputPath, outputName) => {
  try {
    const mediaType = getMediaType(inputPath);
    
    if (mediaType === 'image') {
      return {
        type: 'image',
        url: `http://192.168.0.161:5000/media/${path.basename(inputPath)}`
      };
    }

    if (mediaType !== 'video') {
      throw new Error('Unsupported media type');
    }

    const outputPath = path.join(hlsOutputDir, outputName);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Clean up old files
    cleanupOldHLSFiles(outputPath);

    // Start FFmpeg process with improved error handling
    const command = ffmpeg(inputPath)
      .addOptions([
        '-c:v libx264', // Video codec
        '-c:a aac',     // Audio codec
        '-f hls',       // Output format
        '-hls_time 2',  // Duration of each segment
        '-hls_list_size 3', // Number of segments to keep
        '-hls_flags delete_segments+append_list', // Delete old segments and append to list
        '-hls_segment_type mpegts',   // Segment type
        '-hls_segment_filename', path.join(outputPath, 'segment_%03d.ts'), // Segment filename pattern
        '-hls_playlist_type vod',     // Video on demand
        '-hls_segment_options', 'movflags=+faststart', // Enable fast start
        '-preset ultrafast', // Faster encoding
        '-tune zerolatency', // Reduce latency
        '-maxrate 2500k',    // Maximum bitrate
        '-bufsize 5000k',    // Buffer size
        '-start_number 0'    // Start segment numbering from 0
      ])
      .output(path.join(outputPath, 'playlist.m3u8'))
      .on('start', (commandLine) => {
        console.log('Started FFmpeg with command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log('Processing: ' + progress.percent + '% done');
      })
      .on('end', () => {
        console.log(`HLS stream created for ${outputName}`);
      })
      .on('error', (err) => {
        console.error(`Error creating HLS stream: ${err.message}`);
        // Clean up on error
        try {
          if (fs.existsSync(outputPath)) {
            fs.rmSync(outputPath, { recursive: true, force: true });
          }
        } catch (cleanupError) {
          console.error('Error cleaning up after failed stream:', cleanupError);
        }
      });

    command.run();
    return {
      type: 'video',
      command,
      url: `http://192.168.0.161:8000/live/${outputName}/index.m3u8`,
      outputPath
    };
  } catch (error) {
    console.error('Error in startHLSStream:', error);
    throw error;
  }
};

// Function to stop HLS streaming
const stopHLSStream = (stream) => {
  try {
    if (stream && stream.type === 'video') {
      if (stream.command) {
        stream.command.kill();
      }
      
      // Clean up the output directory
      if (stream.outputPath && fs.existsSync(stream.outputPath)) {
        fs.rmSync(stream.outputPath, { recursive: true, force: true });
      }
    }
  } catch (error) {
    console.error('Error stopping HLS stream:', error);
    throw error;
  }
};

// Export functions
module.exports = {
  startHLSStream,
  stopHLSStream,
  getMediaType
};
