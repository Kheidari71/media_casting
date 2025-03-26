import React, { useState, useRef, useEffect } from "react";
import { Folder } from "lucide-react";
import { createMediaItem } from "../../utils/mediaUtils";
import { ChonkyIconFA } from 'chonky-icon-fontawesome';
import { FileBrowser, ChonkyActions } from 'chonky';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB95tnt1BHAvsiLDxc1aLnexOBLRK9RH0U",
  authDomain: "external-database-651a3.firebaseapp.com",
  projectId: "external-database-651a3",
  storageBucket: "external-database-651a3.firebasestorage.app",
  messagingSenderId: "768078709169",
  appId: "1:768078709169:web:b4e8ef3341295c5eeefd90",
  measurementId: "G-9XKS58406L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

export default function DirectoryModal({ isOpen, onClose, onAddDirectory, isDatabasePlaylist }) {
  const [directoryName, setDirectoryName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isDatabasePlaylist && isOpen) {
      fetchFiles();
    }
  }, [isDatabasePlaylist, isOpen]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("Starting to fetch files from Firebase...");
      
      // Try to list files directly from the root
      const rootRef = ref(storage);
      console.log("Attempting to list files from root...");
      
      const result = await listAll(rootRef);
      console.log("Files found:", result);
      
      if (!result.items || result.items.length === 0) {
        console.log("No files found");
        setFiles([]);
        return;
      }

      console.log(`Found ${result.items.length} files`);
      
      const filePromises = result.items.map(async (item) => {
        try {
          console.log("Processing file:", item.name);
          const downloadURL = await getDownloadURL(item);
          console.log("Got download URL for:", item.name);
          return {
            id: item.name,
            name: item.name,
            path: downloadURL,
            type: item.name.match(/\.(jpg|jpeg|png|gif)$/i) ? 'image' : 'video',
            size: 0,
            isDir: false,
            isHidden: false,
            isSymlink: false,
            isEncrypted: false,
            openable: true,
            selectable: true,
            draggable: true,
            droppable: false,
            isDraft: false,
            color: '#3b82f6',
            modDate: new Date().toISOString(),
            childrenCount: 0,
            children: [],
          };
        } catch (fileError) {
          console.error(`Error processing file ${item.name}:`, fileError);
          return null;
        }
      });

      const fetchedFiles = (await Promise.all(filePromises)).filter(file => file !== null);
      console.log("All files processed:", fetchedFiles);
      setFiles(fetchedFiles);
    } catch (error) {
      console.error("Error fetching files:", error);
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      setError(error.message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

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
    setError(null);
  
    try {
      if (isDatabasePlaylist) {
        // Handle Firebase upload
        const uploadPromises = selectedFiles.map(async (file) => {
          try {
            console.log("Uploading file:", file.name);
            const storageRef = ref(storage, file.name);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            console.log("File uploaded successfully:", file.name);
            return {
              name: file.name,
              path: downloadURL,
              type: file.type.startsWith('video/') ? 'video' : 'image',
              size: file.size
            };
          } catch (uploadError) {
            console.error(`Error uploading file ${file.name}:`, uploadError);
            throw uploadError;
          }
        });

        const uploadedFiles = await Promise.all(uploadPromises);
        onAddDirectory(directoryName, uploadedFiles);
        await fetchFiles(); // Refresh the file list after upload
      } else {
        // Process files and upload to server
        const mediaItemPromises = selectedFiles.map(createMediaItem);
        const mediaItems = await Promise.all(mediaItemPromises);
        const validMediaItems = mediaItems.filter(item => item !== null);
    
        if (validMediaItems.length === 0) {
          alert("No valid media files were uploaded");
          return;
        }
    
        onAddDirectory(directoryName, validMediaItems);
      }
      onClose();
      
      // Reset form
      setDirectoryName("");
      setSelectedFiles([]);
    } catch (error) {
      console.error("Error creating directory:", error);
      setError(error.message);
      alert("An error occurred while uploading files");
    } finally {
      setIsUploading(false);
    }
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const chonkyConfig = {
    iconComponent: ChonkyIconFA,
    defaultFileView: 'grid',
    disableDefaultFileActions: false,
    disableDragAndDrop: false,
    enableDragAndDrop: true,
    fileActions: [
      ChonkyActions.UploadFiles,
      ChonkyActions.DeleteFiles,
      ChonkyActions.DownloadFiles,
    ],
    theme: {
      currentTheme: 'light',
      baseColors: {
        primary: '#3b82f6',
        secondary: '#6b7280',
      },
    },
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Add Media Directory</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            Error: {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Directory Name
          </label>
          <input
            type="text"
            value={directoryName}
            onChange={(e) => setDirectoryName(e.target.value)}
            placeholder="Enter directory name"
            className="w-full px-3 py-2 bg-white rounded border border-gray-300 text-gray-800"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Media Files
          </label>
          {isDatabasePlaylist ? (
            <div className="h-[500px] bg-white rounded border border-gray-200">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-600">Loading files...</div>
                </div>
              ) : (
                <FileBrowser
                  files={files}
                  folderChain={[]}
                  {...chonkyConfig}
                  onFileSelect={setSelectedFiles}
                  enableDragAndDrop={true}
                  enableFileSelection={true}
                  enableFileActions={true}
                  hideToolbarInfo={false}
                  hideFolderChain={true}
                  hideSearchBar={true}
                  hideSortOptions={true}
                  hideViewOptions={true}
                  defaultFileView="grid"
                  thumbnailGenerator={(file) => {
                    if (file.type === 'image') {
                      return file.path;
                    }
                    return null;
                  }}
                  onFileAction={async (data) => {
                    if (data.id === ChonkyActions.UploadFiles.id) {
                      const files = data.payload.files;
                      setSelectedFiles(files);
                    }
                  }}
                />
              )}
            </div>
          ) : (
            <>
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
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded border border-gray-600 text-white"
              >
                <Folder size={16} />
                <span>Browse Files</span>
              </button>

              {selectedFiles.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  {selectedFiles.length} file(s) selected
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isUploading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
          >
            {isUploading ? "Uploading..." : "Add Directory"}
          </button>
        </div>
      </div>
    </div>
  );
}