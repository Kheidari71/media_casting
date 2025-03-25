import React, { useState, useRef } from "react";
import { Folder } from "lucide-react";
import { createMediaItem } from "../../utils/mediaUtils";

// Directory Selection Modal
export default function DirectoryModal({ isOpen, onClose, onAddDirectory, isDatabasePlaylist }) {
  const [directoryName, setDirectoryName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  const handleSubmit = async () => {
    if (!directoryName.trim()) {
      alert("Please enter a directory name");
      return;
    }
  
    if (selectedFiles.length === 0) {
      alert("Please select at least one file");
      return;
    }
  
    setIsUploading(true);
  
    try {
      // Process files and upload to server
      const mediaItemPromises = selectedFiles.map(createMediaItem);
      const mediaItems = await Promise.all(mediaItemPromises);
      const validMediaItems = mediaItems.filter(item => item !== null);
  
      if (validMediaItems.length === 0) {
        alert("No valid media files were uploaded");
        return;
      }
  
      onAddDirectory(directoryName, validMediaItems);
      onClose();
      
      // Reset form
      setDirectoryName("");
      setSelectedFiles([]);
    } catch (error) {
      console.error("Error creating directory:", error);
      alert("An error occurred while uploading files");
    } finally {
      setIsUploading(false);
    }
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
            disabled={isUploading}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded disabled:opacity-50"
          >
            {isUploading ? "Uploading..." : "Add Directory"}
          </button>
        </div>
      </div>
    </div>
  );
}