"use client";

import { useState, useRef, useEffect } from "react";
import { FiMoreVertical, FiEdit, FiTrash2, FiShare2, FiLink } from "react-icons/fi";
import type { Video } from "@/types";

interface VideoOptionsMenuProps {
  video: Video;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
}

export function VideoOptionsMenu({
  video,
  isOwner,
  onEdit,
  onDelete,
  onShare,
}: VideoOptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/watch/${video.id}`;
    navigator.clipboard.writeText(url);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 bg-black/60 rounded-full hover:bg-black/80 transition-all"
        aria-label="More options"
      >
        <FiMoreVertical className="w-4 h-4 text-white" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-[#18122D] border border-[#EB83EA]/20 rounded-lg shadow-xl shadow-black/50 overflow-hidden z-50">
          {isOwner && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onEdit();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-[#EB83EA]/10 transition-colors text-left"
              >
                <FiEdit className="w-4 h-4" />
                <span>Edit</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onDelete();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-red-400 hover:bg-red-500/10 transition-colors text-left"
              >
                <FiTrash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
              <div className="h-px bg-[#EB83EA]/10" />
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onShare();
            }}
            className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-[#EB83EA]/10 transition-colors text-left"
          >
            <FiShare2 className="w-4 h-4" />
            <span>Share</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyLink();
            }}
            className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-[#EB83EA]/10 transition-colors text-left"
          >
            <FiLink className="w-4 h-4" />
            <span>Copy Link</span>
          </button>
        </div>
      )}
    </div>
  );
}
