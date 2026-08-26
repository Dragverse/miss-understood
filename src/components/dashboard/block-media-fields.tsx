"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { FiUpload, FiX, FiArrowUp, FiArrowDown, FiCheck } from "react-icons/fi";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";
import { getVideosByCreator } from "@/lib/supabase/videos";

const inputClass =
  "w-full bg-[#0f071a] border border-[#2f2942] rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-gray-600";

export interface BlockImage {
  url: string;
  caption?: string;
}

/**
 * Upload, caption, reorder and remove the photos held on a gallery block.
 *
 * Images go through /api/upload/image-v2, which authenticates, optimises with
 * sharp and stores in Supabase — the same path the rest of the app uses, so
 * the resulting URLs pass the block schema's own-storage check.
 */
export function ImagesField({
  value,
  label,
  help,
  onChange,
}: {
  value: BlockImage[];
  label: string;
  help?: string;
  onChange: (images: BlockImage[]) => void;
}) {
  const { getAccessToken } = usePrivy();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList) {
    setError(null);
    const list = Array.from(files);
    setUploading(list.length);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not signed in");

      // Sequential rather than parallel: these are multi-megabyte uploads and
      // a phone on mobile data does far better one at a time.
      const uploaded: BlockImage[] = [];
      for (const file of list) {
        const form = new FormData();
        form.append("file", file);

        const response = await fetch("/api/upload/image-v2", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Upload failed");

        uploaded.push({ url: data.url });
        setUploading((n) => n - 1);
      }

      onChange([...value, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      <span className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">{label}</span>
      {help && <p className="text-xs text-gray-500 mb-2">{help}</p>}

      {value.length > 0 && (
        <ul className="space-y-2 mb-2">
          {value.map((image, index) => (
            <li key={`${image.url}-${index}`} className="flex gap-2 items-start">
              <div className="relative w-14 h-14 rounded overflow-hidden bg-black/40 flex-shrink-0">
                <Image src={image.url} alt="" fill sizes="56px" className="object-cover" />
              </div>

              <input
                value={image.caption ?? ""}
                placeholder="Caption (optional)"
                onChange={(e) =>
                  onChange(
                    value.map((img, i) =>
                      i === index ? { ...img, caption: e.target.value || undefined } : img
                    )
                  )
                }
                className={inputClass}
              />

              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <MiniButton label="Move photo up" onClick={() => move(index, -1)} disabled={index === 0}>
                  <FiArrowUp size={12} />
                </MiniButton>
                <MiniButton
                  label="Move photo down"
                  onClick={() => move(index, 1)}
                  disabled={index === value.length - 1}
                >
                  <FiArrowDown size={12} />
                </MiniButton>
              </div>

              <MiniButton
                label="Remove photo"
                destructive
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <FiX size={12} />
              </MiniButton>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="sr-only"
        onChange={(e) => e.target.files?.length && void upload(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading > 0}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[#2f2942] text-gray-300 hover:text-white hover:border-[#EB83EA] transition-colors disabled:opacity-50"
      >
        <FiUpload size={12} />
        {uploading > 0 ? `Uploading ${uploading}…` : "Upload photos"}
      </button>

      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      <p className="mt-1 text-[11px] text-gray-600">JPG, PNG, WebP or GIF, up to 10MB each.</p>
    </div>
  );
}

interface PickableVideo {
  id: string;
  title: string;
  thumbnail?: string;
}

/**
 * Choose one of the creator's own videos to highlight.
 *
 * Fetches the creator's videos directly rather than taking them as a prop, so
 * the editor doesn't need the board's content threaded through it.
 */
export function VideoPickerField({
  value,
  label,
  help,
  creatorDid,
  onChange,
}: {
  value: string | undefined;
  label: string;
  help?: string;
  creatorDid: string | null;
  onChange: (id: string | undefined) => void;
}) {
  const [videos, setVideos] = useState<PickableVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creatorDid) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        // Same client-side helper the profile page uses. /api/videos/list has
        // no creator filter, and only id/title/thumbnail are needed here — the
        // anon-key playback_url truncation doesn't matter for a picker.
        const rows = await getVideosByCreator(creatorDid, 50, true);
        if (cancelled) return;
        setVideos(
          rows.map((v) => ({ id: v.id, title: v.title, thumbnail: v.thumbnail ?? undefined }))
        );
      } catch {
        if (!cancelled) setVideos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [creatorDid]);

  return (
    <div>
      <span className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">{label}</span>
      {help && <p className="text-xs text-gray-500 mb-2">{help}</p>}

      {loading ? (
        <p className="text-xs text-gray-500">Loading your videos…</p>
      ) : videos.length === 0 ? (
        <p className="text-xs text-gray-500">No videos yet.</p>
      ) : (
        <ul className="space-y-1 max-h-56 overflow-y-auto pr-1">
          <li>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${
                !value ? "bg-[#EB83EA]/15 text-white" : "text-gray-400 hover:bg-white/5"
              }`}
            >
              {!value && <FiCheck size={12} className="text-[#EB83EA]" />}
              Newest video (automatic)
            </button>
          </li>
          {videos.map((video) => (
            <li key={video.id}>
              <button
                type="button"
                onClick={() => onChange(video.id)}
                className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg transition-colors ${
                  value === video.id ? "bg-[#EB83EA]/15" : "hover:bg-white/5"
                }`}
              >
                <div className="relative w-12 aspect-video rounded overflow-hidden bg-black/40 flex-shrink-0">
                  <Image
                    src={getSafeThumbnail(video.thumbnail ?? "")}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
                <span className="text-xs text-white truncate flex-1">{video.title}</span>
                {value === video.id && <FiCheck size={12} className="text-[#EB83EA] flex-shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MiniButton({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`p-1 rounded text-gray-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        destructive ? "hover:text-red-400 hover:bg-white/10" : "hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
