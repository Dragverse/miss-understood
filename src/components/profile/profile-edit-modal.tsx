"use client";

import { useState, useRef } from "react";
import { FiX, FiUpload, FiCheck } from "react-icons/fi";
import toast from "react-hot-toast";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { Creator } from "@/types";
import { uploadBanner, uploadAvatar, getImageDataURL } from "@/lib/livepeer/upload-image";

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  creator: Creator;
  onSuccess: () => void;
}

export function ProfileEditModal({
  isOpen,
  onClose,
  creator,
  onSuccess,
}: ProfileEditModalProps) {
  const { getAccessToken } = usePrivy();

  const [formData, setFormData] = useState({
    displayName: creator.displayName,
    handle: creator.handle,
    description: creator.description || "",
    website: creator.website || "",
  });

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(creator.banner || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(creator.avatar);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleBannerChange = async (file: File | null) => {
    if (file) {
      try {
        const preview = await getImageDataURL(file);
        setBannerFile(file);
        setBannerPreview(preview);
      } catch (error) {
        toast.error("Failed to load banner preview");
      }
    }
  };

  const handleAvatarChange = async (file: File | null) => {
    if (file) {
      try {
        const preview = await getImageDataURL(file);
        setAvatarFile(file);
        setAvatarPreview(preview);
      } catch (error) {
        toast.error("Failed to load avatar preview");
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.displayName.trim()) {
      toast.error("Display name is required");
      return;
    }

    if (!formData.handle.trim()) {
      toast.error("Handle is required");
      return;
    }

    // Validate handle format (no spaces)
    if (/\s/.test(formData.handle)) {
      toast.error("Handle cannot contain spaces");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get authentication token
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Authentication required. Please log in again.");
      }

      let bannerUrl = creator.banner;
      let avatarUrl = creator.avatar;

      // Upload banner if changed
      if (bannerFile) {
        toast.loading("Uploading banner...");
        bannerUrl = await uploadBanner(bannerFile, token);
        toast.dismiss();
      }

      // Upload avatar if changed
      if (avatarFile) {
        toast.loading("Uploading avatar...");
        avatarUrl = await uploadAvatar(avatarFile, token);
        toast.dismiss();
      }

      // Save to Ceramic via API endpoint (has fallback to localStorage)
      toast.loading("Saving profile...");

      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          handle: formData.handle,
          displayName: formData.displayName,
          description: formData.description,
          avatar: avatarUrl,
          banner: bannerUrl,
          website: formData.website || undefined,
        }),
      });

      const data = await response.json();
      toast.dismiss();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update profile');
      }

      if (data.fallbackMode) {
        console.warn('Profile saved to localStorage (Ceramic unavailable)');
        // Store in localStorage as backup
        localStorage.setItem('dragverse_profile', JSON.stringify({
          handle: formData.handle,
          displayName: formData.displayName,
          description: formData.description,
          avatar: avatarUrl,
          banner: bannerUrl,
          website: formData.website,
        }));
        toast.success("Profile saved locally (will sync when online)");
      } else {
        toast.success("Profile updated successfully!");
      }

      setUploadSuccess(true);

      // Close modal after brief delay
      setTimeout(() => {
        setUploadSuccess(false);
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="relative w-full max-w-2xl bg-[#1a0b2e] border border-[#2f2942] rounded-[24px] p-6 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full transition disabled:opacity-50"
        >
          <FiX className="w-5 h-5" />
        </button>

        {uploadSuccess ? (
          // Success State
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
              <FiCheck className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Profile Updated!</h2>
            <p className="text-gray-400">Your changes have been saved.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Edit Profile</h2>
              <p className="text-gray-400 text-sm">
                Update your profile information and images
              </p>
            </div>

            {/* Banner Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Banner Image (1920x480 recommended)
              </label>
              <div
                className="relative h-32 rounded-xl overflow-hidden border-2 border-dashed border-[#2f2942] hover:border-[#EB83EA] transition cursor-pointer group"
                onClick={() => bannerInputRef.current?.click()}
              >
                {bannerPreview ? (
                  <Image
                    src={bannerPreview}
                    alt="Banner preview"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f071a]">
                    <FiUpload className="w-8 h-8 text-gray-500 mb-2" />
                    <p className="text-sm text-gray-500">Click to upload banner</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <FiUpload className="w-6 h-6" />
                </div>
              </div>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleBannerChange(e.target.files?.[0] || null)}
                disabled={isSubmitting}
              />
            </div>

            {/* Avatar Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Avatar (400x400 recommended)
              </label>
              <div className="flex items-center gap-4">
                <div
                  className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#2f2942] hover:border-[#EB83EA] transition cursor-pointer group"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Image
                    src={avatarPreview}
                    alt="Avatar preview"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <FiUpload className="w-5 h-5" />
                  </div>
                </div>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#2f2942] hover:bg-[#3f3952] rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  Change Avatar
                </button>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
                disabled={isSubmitting}
              />
            </div>

            {/* Display Name */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Display Name *
              </label>
              <input
                type="text"
                maxLength={100}
                value={formData.displayName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, displayName: e.target.value }))
                }
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition disabled:opacity-50"
                placeholder="Your name"
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {formData.displayName.length}/100
              </p>
            </div>

            {/* Handle */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Handle *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  @
                </span>
                <input
                  type="text"
                  maxLength={50}
                  value={formData.handle}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      handle: e.target.value.replace(/\s/g, ""),
                    }))
                  }
                  disabled={isSubmitting}
                  className="w-full pl-8 pr-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition disabled:opacity-50"
                  placeholder="yourhandle"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {formData.handle.length}/50
              </p>
            </div>

            {/* Bio/Description */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Bio
              </label>
              <textarea
                maxLength={1000}
                rows={4}
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition resize-none disabled:opacity-50"
                placeholder="Tell us about yourself..."
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {formData.description.length}/1000
              </p>
            </div>

            {/* Website */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Website
              </label>
              <input
                type="url"
                maxLength={200}
                value={formData.website}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, website: e.target.value }))
                }
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition disabled:opacity-50"
                placeholder="https://yourwebsite.com"
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full px-6 py-4 bg-[#EB83EA] hover:bg-[#E748E6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full transition-colors"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
