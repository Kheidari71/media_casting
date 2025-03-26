import React from "react";
import { X, Trash2, ChevronDown, ChevronRight, Folder, Video, Image } from "lucide-react";
import { formatFileSize } from "../../utils/mediaUtils";
import { ArrowUp, ArrowDown } from "lucide-react";

export default function PlaylistSidebar({
  directories,
  playlist,
  currentIndex,
  isPlaying,
  activeDirectory,
  toggleDirectoryView,
  removeDirectory,
  removeFromPlaylist,
  playMedia,
  isDatabasePlaylist
}) {
  // Filter and sort playlist items
  const filteredPlaylist = playlist;

  return (
    <div className="w-1/3 bg-gray-900 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">
          {/* {isDatabasePlaylist ? "Database Playlist" : "Local Playlist"} */}
          Playlist
        </h2>
      </div>

      {/* Show directories with their media items */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2">
          {directories.map((dir) => (
            <div
             key={dir.id} className="bg-gray-800 rounded overflow-hidden">
              <div className="flex items-center justify-between p-2">
                <button
                  onClick={() => toggleDirectoryView(dir.id)}
                  className="flex items-center space-x-2 text-white hover:text-teal-400"
                >
                  {activeDirectory === dir.id ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                  <Folder size={16} />
                  <span>{dir.name}</span>
                </button>
                <button
                  onClick={() => removeDirectory(dir.id)}
                  className="text-gray-400 hover:text-red-400"
                >
                  <X size={16} />
                </button>
              </div>
              
              {/* Show media items when directory is active */}
              {activeDirectory === dir.id && (
                <div className="pl-8 pr-2 pb-2">
                  {playlist
                    .filter(item => item.directoryId === dir.id)
                    .map((item) => {
                      const fullPlaylistIndex = playlist.findIndex(p => p.id === item.id);
                      return (
                        <div
                          key={item.id || item.path}
                          className={`flex items-center justify-between p-2 rounded cursor-pointer mb-1 ${
                            fullPlaylistIndex === currentIndex
                              ? "bg-teal-600"
                              : "bg-gray-700 hover:bg-gray-600"
                          }`}
                          onClick={() => playMedia(fullPlaylistIndex)}
                        >
                          <div className="flex items-center space-x-2">
                            {item.type === "video" ? (
                              <Video size={16} />
                            ) : (
                              <Image size={16} />
                            )}
                            <span className="text-white">{item.name}</span>
                          </div>
                          {!isDatabasePlaylist && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromPlaylist(item.id);
                              }}
                              className="text-gray-400 hover:text-red-400"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}