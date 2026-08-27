"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";

export interface LightboxImage {
  url: string;
  caption?: string;
}

/**
 * Full-screen image viewer.
 *
 * Shows the image at its own proportions with `object-contain` — nothing is
 * cropped, which is the whole point of expanding it. Board thumbnails may be
 * cropped to fit a grid; this is where the real photo is seen.
 */
export function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const image = images[index];
  const many = images.length > 1;

  const go = useCallback(
    (delta: number) => {
      // Wrap, so arrowing past the end returns to the start rather than
      // dead-ending on a disabled control.
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (!many) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);

    // Stop the page scrolling behind the overlay.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, go, many]);

  if (!image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.caption || "Expanded image"}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-fade-in"
      // Backdrop click closes; the image itself stops propagation below.
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-4 flex-shrink-0">
        <span className="text-xs text-white/50 tabular-nums">
          {many ? `${index + 1} / ${images.length}` : ""}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <FiX size={22} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 pb-4">
        {many && (
          <LightboxArrow side="left" onClick={() => go(-1)} />
        )}

        {/*
          width/height are hints for the intrinsic ratio; the classes below let
          it scale to fit while keeping its own shape. Using `fill` here would
          force a crop, which defeats the purpose.
        */}
        <Image
          src={image.url}
          alt={image.caption ?? ""}
          width={2000}
          height={2000}
          sizes="100vw"
          className="max-h-full max-w-full w-auto h-auto object-contain rounded-lg"
          onClick={(event) => event.stopPropagation()}
          priority
        />

        {many && <LightboxArrow side="right" onClick={() => go(1)} />}
      </div>

      {image.caption && (
        <p className="flex-shrink-0 px-6 pb-6 text-center text-sm text-white/70">
          {image.caption}
        </p>
      )}
    </div>
  );
}

function LightboxArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? FiChevronLeft : FiChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous image" : "Next image"}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`absolute ${
        side === "left" ? "left-2" : "right-2"
      } top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition-colors`}
    >
      <Icon size={22} />
    </button>
  );
}

/**
 * Hook for the common case: a set of images and a click handler that opens
 * the lightbox at the right one.
 */
export function useLightbox(images: LightboxImage[]) {
  const [index, setIndex] = useState<number | null>(null);

  return {
    open: (at: number) => setIndex(at),
    element:
      index === null ? null : (
        <ImageLightbox
          images={images}
          index={index}
          onClose={() => setIndex(null)}
          onIndexChange={setIndex}
        />
      ),
  };
}
