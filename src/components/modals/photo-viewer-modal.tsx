"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FiX, FiChevronLeft, FiChevronRight, FiExternalLink } from "react-icons/fi";
import { BlueskyPostActions } from "@/components/bluesky/post-actions";

interface PhotoPost {
  id: string;
  thumbnail: string;
  description: string;
  creator: {
    displayName: string;
    handle: string;
    avatar: string;
  };
  likes: number;
  replyCount?: number;
  reposts?: number;
  externalUrl: string;
  createdAt: Date | string;
  uri?: string;
  cid?: string;
}

interface PhotoViewerModalProps {
  photos: PhotoPost[];
  initialIndex: number;
  onClose: () => void;
}

export function PhotoViewerModal({ photos, initialIndex, onClose }: PhotoViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const modalRef = useRef<HTMLDivElement>(null);

  const currentPhoto = photos[currentIndex];

  useEffect(() => {
    // Lock body scroll when modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < photos.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, photos.length, onClose]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return num.toString();
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === modalRef.current) {
          onClose();
        }
      }}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-12 h-12 rounded-full bg-black/80 hover:bg-black/90 flex items-center justify-center transition-all"
      >
        <FiX className="w-6 h-6 text-white" />
      </button>

      {/* Navigation Buttons */}
      {currentIndex > 0 && (
        <button
          onClick={handlePrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-black/80 hover:bg-black/90 flex items-center justify-center transition-all"
        >
          <FiChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}

      {currentIndex < photos.length - 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-black/80 hover:bg-black/90 flex items-center justify-center transition-all"
        >
          <FiChevronRight className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Photo Counter */}
      <div className="absolute top-4 left-4 z-50 px-4 py-2 rounded-full bg-black/80 text-white text-sm font-semibold">
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Main Content */}
      <div className="w-full h-full max-w-7xl mx-auto p-4 flex items-center justify-center gap-8">
        {/* Photo Display */}
        <div className="flex-1 h-full flex items-center justify-center">
          <div className="relative w-full h-full max-h-[85vh] flex items-center justify-center">
            <Image
              src={currentPhoto.thumbnail}
              alt={currentPhoto.description || "Photo"}
              width={1200}
              height={1200}
              className="object-contain max-h-full max-w-full rounded-2xl"
              priority
            />
          </div>
        </div>

        {/* Photo Info Sidebar */}
        <div className="w-[400px] h-full max-h-[85vh] bg-[#1a0b2e] rounded-2xl border-2 border-[#2f2942] p-6 overflow-y-auto flex flex-col gap-6">
          {/* Creator Info */}
          <div className="flex items-center gap-3">
            <Image
              src={currentPhoto.creator.avatar}
              alt={currentPhoto.creator.displayName}
              width={56}
              height={56}
              className="rounded-full border-2 border-[#EB83EA]/30"
            />
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-lg truncate">
                {currentPhoto.creator.displayName}
              </p>
              <p className="text-gray-400 text-sm truncate">
                @{currentPhoto.creator.handle}
              </p>
            </div>
          </div>

          {/* Engagement Stats / Interaction Buttons */}
          {currentPhoto.uri && currentPhoto.cid ? (
            <BlueskyPostActions
              postUri={currentPhoto.uri}
              postCid={currentPhoto.cid}
              externalUrl={currentPhoto.externalUrl}
              initialLikes={currentPhoto.likes}
              initialReposts={currentPhoto.reposts || 0}
              initialComments={currentPhoto.replyCount || 0}
              size="md"
            />
          ) : (
            <div className="flex items-center gap-6 text-white/60 text-sm">
              {currentPhoto.likes > 0 && (
                <span>{formatNumber(currentPhoto.likes)} likes</span>
              )}
              {currentPhoto.replyCount !== undefined && currentPhoto.replyCount > 0 && (
                <span>{formatNumber(currentPhoto.replyCount)} comments</span>
              )}
            </div>
          )}

          {/* Description */}
          {currentPhoto.description && (
            <div>
              <h3 className="text-white font-bold text-sm mb-2 uppercase tracking-wider">
                Description
              </h3>
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                {currentPhoto.description}
              </p>
            </div>
          )}

          {/* Date */}
          <div>
            <h3 className="text-white font-bold text-sm mb-2 uppercase tracking-wider">
              Posted
            </h3>
            <p className="text-gray-400 text-sm">{formatDate(currentPhoto.createdAt)}</p>
          </div>

          {/* View on Bluesky Button */}
          <a
            href={currentPhoto.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] rounded-xl font-bold transition-all shadow-lg shadow-[#EB83EA]/30 text-white"
          >
            <FiExternalLink className="w-5 h-5" />
            View on Bluesky
          </a>
        </div>
      </div>
    </div>
  );
}
