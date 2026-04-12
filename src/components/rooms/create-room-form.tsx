"use client";

import { useState } from "react";
import { FiPlus, FiX, FiGlobe, FiLock } from "react-icons/fi";
import { usePrivy } from "@privy-io/react-auth";
import { useRoomStore } from "@/lib/store/room";
import toast from "react-hot-toast";

const SUGGESTED_TAGS = ["#lofi", "#drag", "#chill", "#ballroom", "#deep", "#talk", "#podcast", "#music"];

interface CreateRoomFormProps {
  onCreated?: (roomId: string) => void;
}

export function CreateRoomForm({ onCreated }: CreateRoomFormProps) {
  const { getAccessToken, user } = usePrivy();
  const { setActiveRoom, openPanel } = useRoomStore();

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [loading, setLoading] = useState(false);

  const addTag = (tag: string) => {
    const clean = tag.startsWith("#") ? tag : `#${tag}`;
    if (!tags.includes(clean) && tags.length < 5) {
      setTags([...tags, clean]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput.trim());
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Give your room a title");
      return;
    }
    if (!user) {
      toast.error("Sign in to create a room");
      return;
    }

    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), tags, privacy }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create room");

      // Set as active room immediately
      setActiveRoom({
        roomId: data.roomId,
        title: title.trim(),
        hostName: "You",
        hostAvatar: "/defaultpfp.png",
        isHost: true,
      });

      openPanel();
      if (onCreated) onCreated(data.roomId);
    } catch (err: any) {
      toast.error(err.message || "Could not create room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1a0b2e] border border-[#2f2942] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-6 h-6 rounded-full bg-[#EB83EA] flex items-center justify-center">
          <FiPlus className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-[#EB83EA] font-black uppercase tracking-widest text-sm">
          Create Room
        </h2>
      </div>

      {/* Title */}
      <div className="mb-4">
        <label className="block text-gray-400 text-[11px] font-semibold uppercase tracking-wider mb-1.5">
          Room Title
        </label>
        <input
          type="text"
          placeholder="What's the vibe?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          className="w-full bg-[#0f071a] border border-[#2f2942] focus:border-[#EB83EA]/50 rounded-xl px-4 py-3 text-white text-sm outline-none transition placeholder-gray-600"
        />
      </div>

      {/* Tags */}
      <div className="mb-4">
        <label className="block text-gray-400 text-[11px] font-semibold uppercase tracking-wider mb-1.5">
          Tags
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#EB83EA]/20 border border-[#EB83EA]/30 rounded-full text-[#EB83EA] text-xs font-semibold"
            >
              {tag}
              <button onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                <FiX className="w-3 h-3" />
              </button>
            </span>
          ))}
          {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 4 - tags.length).map((t) => (
            <button
              key={t}
              onClick={() => addTag(t)}
              className="px-2.5 py-1 bg-white/5 border border-white/10 hover:border-[#EB83EA]/40 rounded-full text-gray-400 text-xs transition"
            >
              {t}
            </button>
          ))}
          {tags.length < 5 && (
            <button
              onClick={() => {
                const val = window.prompt("Add tag (without #):");
                if (val?.trim()) addTag(val.trim());
              }}
              className="px-2.5 py-1 bg-white/5 border border-white/10 hover:border-[#EB83EA]/40 rounded-full text-gray-400 text-xs transition"
            >
              + Add
            </button>
          )}
        </div>
      </div>

      {/* Privacy */}
      <div className="mb-5">
        <label className="block text-gray-400 text-[11px] font-semibold uppercase tracking-wider mb-1.5">
          Privacy
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setPrivacy("public")}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
              privacy === "public"
                ? "bg-[#EB83EA]/20 border-[#EB83EA] text-white"
                : "bg-white/5 border-white/10 text-gray-400"
            }`}
          >
            <FiGlobe className="w-5 h-5" />
            <span className="text-xs font-bold">Public</span>
          </button>
          <button
            onClick={() => setPrivacy("private")}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
              privacy === "private"
                ? "bg-[#EB83EA]/20 border-[#EB83EA] text-white"
                : "bg-white/5 border-white/10 text-gray-400"
            }`}
          >
            <FiLock className="w-5 h-5" />
            <span className="text-xs font-bold">Private</span>
          </button>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={handleCreate}
        disabled={loading || !title.trim()}
        className="w-full py-3.5 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-black uppercase tracking-widest text-white text-sm transition-all shadow-lg shadow-[#EB83EA]/20"
      >
        {loading ? "Creating..." : "Go Live Now"}
      </button>
    </div>
  );
}
