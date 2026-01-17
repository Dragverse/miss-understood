"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiUser, FiLink2, FiUpload, FiSave, FiArrowLeft } from "react-icons/fi";
import { FaInstagram, FaTiktok } from "react-icons/fa";
import Image from "next/image";
import toast from "react-hot-toast";
import { useAuthUser } from "@/lib/privy/hooks";
import { Creator } from "@/types";
import { uploadBanner, uploadAvatar, getImageDataURL } from "@/lib/livepeer/upload-image";
import { getCreatorByDID } from "@/lib/ceramic/creators";

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, isReady, userHandle, userEmail, user, instagramHandle, tiktokHandle, farcasterHandle } = useAuthUser();

  const [activeSection, setActiveSection] = useState<"profile" | "accounts">("profile");
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [creator, setCreator] = useState<Creator | null>(null);
  const [formData, setFormData] = useState({
    displayName: "",
    handle: "",
    description: "",
    website: "",
  });

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Load profile data
  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;

      setIsLoadingProfile(true);
      try {
        // Try to load from Ceramic first
        const ceramicProfile = await getCreatorByDID(user.id);

        if (ceramicProfile) {
          setCreator(ceramicProfile as Creator);
          setFormData({
            displayName: ceramicProfile.displayName,
            handle: ceramicProfile.handle,
            description: ceramicProfile.description || "",
            website: ceramicProfile.website || "",
          });
          setBannerPreview(ceramicProfile.banner || null);
          setAvatarPreview(ceramicProfile.avatar);
          return;
        }
      } catch (error) {
        console.warn("Could not load from Ceramic, checking fallback:", error);
      }

      // Fallback: Load from localStorage if Ceramic unavailable
      const fallbackProfile = localStorage.getItem("dragverse_profile");
      if (fallbackProfile) {
        try {
          const profileData = JSON.parse(fallbackProfile);
          setFormData({
            displayName: profileData.displayName || "",
            handle: profileData.handle || "",
            description: profileData.description || "",
            website: profileData.website || "",
          });
          setBannerPreview(profileData.banner || null);
          setAvatarPreview(profileData.avatar || user?.twitter?.profilePictureUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${userHandle}&backgroundColor=EB83EA`);
          console.log("Loaded profile from fallback storage");
          setIsLoadingProfile(false);
          return;
        } catch (e) {
          console.error("Failed to parse fallback profile:", e);
        }
      }

      // No Ceramic or fallback profile, use Privy data
      const defaultCreator: Creator = {
        did: user.id,
        handle: userHandle || userEmail?.split('@')[0] || "user",
        displayName: userHandle || userEmail?.split('@')[0] || "Drag Artist",
        avatar: user?.twitter?.profilePictureUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${userHandle}&backgroundColor=EB83EA`,
        description: "Welcome to my Dragverse profile! 🎭✨",
        followerCount: 0,
        followingCount: 0,
        createdAt: new Date(user.createdAt || Date.now()),
        verified: false,
        instagramHandle: instagramHandle || undefined,
        tiktokHandle: tiktokHandle || undefined,
      };
      setCreator(defaultCreator);
      setFormData({
        displayName: defaultCreator.displayName,
        handle: defaultCreator.handle,
        description: defaultCreator.description,
        website: "",
      });
      setAvatarPreview(defaultCreator.avatar);
      setIsLoadingProfile(false);
    }

    if (isAuthenticated) {
      loadProfile();
    }
  }, [isAuthenticated, user?.id]);

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

  const handleSave = async () => {
    if (!formData.displayName.trim()) {
      toast.error("Display name is required");
      return;
    }

    if (!formData.handle.trim()) {
      toast.error("Handle is required");
      return;
    }

    if (/\s/.test(formData.handle)) {
      toast.error("Handle cannot contain spaces");
      return;
    }

    setIsSaving(true);

    try {
      let bannerUrl = creator?.banner;
      let avatarUrl = creator?.avatar || avatarPreview;

      // Upload banner if changed
      if (bannerFile) {
        toast.loading("Uploading banner...");
        bannerUrl = await uploadBanner(bannerFile);
        toast.dismiss();
      }

      // Upload avatar if changed
      if (avatarFile) {
        toast.loading("Uploading avatar...");
        avatarUrl = await uploadAvatar(avatarFile);
        toast.dismiss();
      }

      // Save profile via API route (with fallback support)
      toast.loading("Saving profile...");
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          handle: formData.handle,
          displayName: formData.displayName,
          description: formData.description,
          avatar: avatarUrl,
          banner: bannerUrl,
          website: formData.website || undefined,
          instagramHandle: instagramHandle || undefined,
          tiktokHandle: tiktokHandle || undefined,
        }),
      });

      toast.dismiss();

      // Check response status first
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Profile save failed: ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to save profile");
      }

      // If in fallback mode, store profile data in localStorage
      if (result.fallbackMode && result.profileData) {
        console.log("Storing profile in fallback mode");
        localStorage.setItem("dragverse_profile", JSON.stringify(result.profileData));
      }

      toast.success(result.message || "Profile saved successfully!");

      // Reset file states
      setBannerFile(null);
      setAvatarFile(null);

      // Reload profile data
      if (user?.id) {
        try {
          const updated = await getCreatorByDID(user.id);
          if (updated) {
            setCreator(updated as Creator);
          }
        } catch (error) {
          // Silently fail if Ceramic is unavailable, we already saved to fallback
          console.warn("Could not reload from Ceramic:", error);
        }
      }
    } catch (error) {
      console.error("Profile save error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save profile"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Redirect if not authenticated
  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EB83EA]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push("/profile");
    return null;
  }

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EB83EA]"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/profile")}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-4"
        >
          <FiArrowLeft className="w-5 h-5" />
          Back to Profile
        </button>
        <h1 className="text-3xl font-bold text-[#FCF1FC]">Settings</h1>
        <p className="text-gray-400 mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-2">
            <button
              onClick={() => setActiveSection("profile")}
              className={`w-full px-4 py-3 rounded-lg text-left flex items-center gap-3 transition ${
                activeSection === "profile"
                  ? "bg-[#EB83EA] text-white"
                  : "bg-[#18122D] text-gray-400 hover:text-white hover:bg-[#2f2942]"
              }`}
            >
              <FiUser className="w-5 h-5" />
              Profile
            </button>
            <button
              onClick={() => setActiveSection("accounts")}
              className={`w-full px-4 py-3 rounded-lg text-left flex items-center gap-3 transition ${
                activeSection === "accounts"
                  ? "bg-[#EB83EA] text-white"
                  : "bg-[#18122D] text-gray-400 hover:text-white hover:bg-[#2f2942]"
              }`}
            >
              <FiLink2 className="w-5 h-5" />
              Connected Accounts
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-[#18122D] rounded-xl p-6 border border-[#2f2942]">
            {activeSection === "profile" && (
              <div>
                <h2 className="text-2xl font-bold text-[#FCF1FC] mb-6">
                  Edit Profile
                </h2>

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
                    disabled={isSaving}
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
                      disabled={isSaving}
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
                    disabled={isSaving}
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
                    disabled={isSaving}
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
                      disabled={isSaving}
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
                    disabled={isSaving}
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
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition disabled:opacity-50"
                    placeholder="https://yourwebsite.com"
                  />
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full px-6 py-4 bg-[#EB83EA] hover:bg-[#E748E6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full transition-colors flex items-center justify-center gap-2"
                >
                  <FiSave className="w-5 h-5" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}

            {activeSection === "accounts" && (
              <div>
                <h2 className="text-2xl font-bold text-[#FCF1FC] mb-6">
                  Connected Accounts
                </h2>
                <p className="text-gray-400 mb-6">
                  These accounts are automatically detected from your Privy sign-in. They will be displayed on your profile.
                </p>

                <div className="space-y-4">
                  {/* Instagram */}
                  <div className="flex items-center justify-between p-4 bg-[#0f071a] rounded-xl border border-[#2f2942]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 via-pink-600 to-yellow-500 flex items-center justify-center">
                        <FaInstagram className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold">Instagram</p>
                        {instagramHandle ? (
                          <p className="text-sm text-gray-400">@{instagramHandle}</p>
                        ) : (
                          <p className="text-sm text-gray-500">Not connected</p>
                        )}
                      </div>
                    </div>
                    {instagramHandle && (
                      <span className="text-xs px-3 py-1 bg-green-500/10 text-green-500 rounded-full">
                        Connected
                      </span>
                    )}
                  </div>

                  {/* TikTok */}
                  <div className="flex items-center justify-between p-4 bg-[#0f071a] rounded-xl border border-[#2f2942]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                        <FaTiktok className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold">TikTok</p>
                        {tiktokHandle ? (
                          <p className="text-sm text-gray-400">@{tiktokHandle}</p>
                        ) : (
                          <p className="text-sm text-gray-500">Not connected</p>
                        )}
                      </div>
                    </div>
                    {tiktokHandle && (
                      <span className="text-xs px-3 py-1 bg-green-500/10 text-green-500 rounded-full">
                        Connected
                      </span>
                    )}
                  </div>

                  {/* Farcaster */}
                  <div className="flex items-center justify-between p-4 bg-[#0f071a] rounded-xl border border-[#2f2942]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">F</span>
                      </div>
                      <div>
                        <p className="font-semibold">Farcaster</p>
                        {farcasterHandle ? (
                          <p className="text-sm text-gray-400">@{farcasterHandle}</p>
                        ) : (
                          <p className="text-sm text-gray-500">Not connected</p>
                        )}
                      </div>
                    </div>
                    {farcasterHandle && (
                      <span className="text-xs px-3 py-1 bg-green-500/10 text-green-500 rounded-full">
                        Connected
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <p className="text-sm text-blue-400">
                    💡 To connect or disconnect accounts, use the Privy sign-in options when logging in.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
