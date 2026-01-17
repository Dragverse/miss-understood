"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiImage, FiX, FiArrowLeft } from "react-icons/fi";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuthUser } from "@/lib/privy/hooks";
import { isBlueskyConnected } from "@/lib/utils/bluesky-auth";
import { getLocalProfile } from "@/lib/utils/local-storage";
import { Creator } from "@/types";

export default function CreatePostPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthUser();
  const [profile, setProfile] = useState<Partial<Creator> | null>(null);
  const [text, setText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  const hasBluesky = isBlueskyConnected(profile);

  useEffect(() => {
    const localProfile = getLocalProfile();
    setProfile(localProfile);

    if (!localProfile || !isBlueskyConnected(localProfile)) {
      toast.error("Please connect your Bluesky account first");
      router.push("/settings");
    }
  }, [router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 4) {
      toast.error("Maximum 4 images per post");
      return;
    }

    setImages([...images, ...files]);

    // Generate previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim() && images.length === 0) {
      toast.error("Post must have text or images");
      return;
    }

    if (!profile?.blueskyHandle || !profile?.blueskyAppPassword) {
      toast.error("Bluesky credentials not found");
      return;
    }

    setPosting(true);

    try {
      // Upload images first if any
      const imageUrls: string[] = [];
      for (const image of images) {
        const formData = new FormData();
        formData.append("file", image);

        toast.loading(`Uploading image ${imageUrls.length + 1}/${images.length}...`);
        const uploadResponse = await fetch("/api/upload/image", {
          method: "POST",
          body: formData,
        });

        toast.dismiss();

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image");
        }

        const uploadData = await uploadResponse.json();
        if (uploadData.url) {
          imageUrls.push(uploadData.url);
        }
      }

      // Create post
      toast.loading("Creating post...");
      const response = await fetch("/api/bluesky/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          images: imageUrls,
          blueskyHandle: profile.blueskyHandle,
          blueskyPassword: profile.blueskyAppPassword,
        }),
      });

      toast.dismiss();

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create post");
      }

      toast.success("Post created successfully!");
      router.push("/feed");
    } catch (error) {
      console.error("Post creation error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create post"
      );
    } finally {
      setPosting(false);
    }
  };

  if (!hasBluesky) {
    return null; // Redirecting in useEffect
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-[#EB83EA] transition mb-4"
        >
          <FiArrowLeft className="w-5 h-5" />
          Back to Feed
        </Link>
        <h1 className="text-2xl font-bold">Create Post</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Text Input */}
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={300}
            rows={6}
            className="w-full px-4 py-3 bg-[#1a0b2e] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition resize-none"
            disabled={posting}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">{text.length}/300</span>
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <label
            className={`flex items-center gap-2 text-sm font-semibold mb-2 ${
              images.length >= 4 || posting
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer hover:text-[#EB83EA] transition"
            }`}
          >
            <FiImage className="w-5 h-5" />
            Add Images (Max 4)
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
              disabled={images.length >= 4 || posting}
            />
          </label>

          {/* Image Previews */}
          {previews.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {previews.map((preview, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-lg overflow-hidden bg-[#0f071a] border border-[#2f2942]"
                >
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="object-cover w-full h-full"
                  />
                  {!posting && (
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80 transition"
                    >
                      <FiX className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={posting || (!text.trim() && images.length === 0)}
            className="flex-1 py-3 bg-[#EB83EA] hover:bg-[#E748E6] rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {posting ? "Posting..." : "Post"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={posting}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
