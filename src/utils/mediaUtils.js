// Format time in minutes:seconds
export const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return "0:00";
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };
  
  // Format file size with appropriate units
  export const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };
  
  // Create a media item object from a File object
  export const createMediaItem = async (file) => {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    
    if (!isVideo && !isImage) {
      return null; // Skip unsupported files
    }
    
    // Upload file to server
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('http://192.168.0.161:5000/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      
      return {
        id: Date.now() + Math.random(),
        name: file.name,
        path: data.url, // Server URL
        type: isVideo ? "video" : "image",
        size: file.size,
      };
    } catch (error) {
      console.error("Error uploading file:", error);
      return null;
    }
  };