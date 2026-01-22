"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiUser, FiLink2, FiUpload, FiSave, FiArrowLeft } from "react-icons/fi";
import { SiBluesky } from "react-icons/si";
import Image from "next/image";
import toast from "react-hot-toast";
import { useAuthUser } from "@/lib/privy/hooks";
import { usePrivy } from "@privy-io/react-auth";
import { Creator } from "@/types";
import { uploadBanner, uploadAvatar, getImageDataURL } from "@/lib/livepeer/upload-image";
import { getCreatorByDID } from "@/lib/supabase/creators";
import { transformSupabaseCreator } from "@/lib/supabase/transformers";
import { saveLocalProfile, getLocalProfile } from "@/lib/utils/local-storage";
import { clearBlueskyCache } from "@/lib/bluesky/hooks";

export default function SettingsPage() {
  const router = useRouter();
  const { getAccessToken } = usePrivy();
  const {
    isAuthenticated,
    isReady,
    userHandle,
    userEmail,
    user,
    farcasterHandle,
    wallets,
    linkedAccounts,
    emailAccount,
    googleAccount,
    linkWallet,
    linkEmail,
    linkGoogle,
    unlinkWallet,
    unlinkEmail,
    unlinkGoogle,
  } = useAuthUser();

  const [activeSection, setActiveSection] = useState<"profile" | "accounts">("profile");
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [creator, setCreator] = useState<Creator | null>(null);
  const [formData, setFormData] = useState({
    displayName: "",
    handle: "",
    description: "",
    website: "",
    instagramHandle: "",
    tiktokHandle: "",
  });

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");

  // Bluesky connection state
  const [showBlueskyModal, setShowBlueskyModal] = useState(false);
  const [blueskyHandleInput, setBlueskyHandleInput] = useState("");
  const [appPasswordInput, setAppPasswordInput] = useState("");
  const [blueskyHandle, setBlueskyHandle] = useState<string | null>(null);
  const [blueskyProfile, setBlueskyProfile] = useState<any | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Utility functions
  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getWalletType = (wallet: any): string => {
    if (wallet.walletClientType) {
      return wallet.walletClientType
        .split('_')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return wallet.connectorType || 'Wallet';
  };

  const canUnlinkAccount = (): boolean => {
    // Must have at least 2 authentication methods to unlink one
    const authMethods = [];
    if (emailAccount) authMethods.push('email');
    if (googleAccount) authMethods.push('google');
    if (farcasterHandle) authMethods.push('farcaster');
    if (wallets && wallets.length > 0) authMethods.push('wallet');
    return authMethods.length > 1;
  };

  // Handle wallet linking
  const handleLinkWallet = async () => {
    try {
      await linkWallet();
      toast.success("Wallet connected successfully");
    } catch (error) {
      console.error("Failed to link wallet:", error);
      toast.error("Failed to connect wallet");
    }
  };

  // Handle wallet unlinking
  const handleUnlinkWallet = async (address: string) => {
    if (!canUnlinkAccount()) {
      toast.error("Cannot unlink: You must have at least one authentication method");
      return;
    }

    if (confirm(`Are you sure you want to unlink wallet ${formatAddress(address)}?`)) {
      try {
        await unlinkWallet(address);
        toast.success("Wallet disconnected");
      } catch (error) {
        console.error("Failed to unlink wallet:", error);
        toast.error("Failed to disconnect wallet");
      }
    }
  };

  // Handle email unlinking
  const handleUnlinkEmail = async () => {
    if (!canUnlinkAccount()) {
      toast.error("Cannot unlink: You must have at least one authentication method");
      return;
    }

    if (confirm(`Are you sure you want to unlink your email account?`)) {
      try {
        await unlinkEmail(emailAccount!.address);
        toast.success("Email disconnected");
      } catch (error) {
        console.error("Failed to unlink email:", error);
        toast.error("Failed to disconnect email");
      }
    }
  };

  // Handle Google unlinking
  const handleUnlinkGoogle = async () => {
    if (!canUnlinkAccount()) {
      toast.error("Cannot unlink: You must have at least one authentication method");
      return;
    }

    if (confirm(`Are you sure you want to unlink your Google account?`)) {
      try {
        await unlinkGoogle(googleAccount!.subject);
        toast.success("Google account disconnected");
      } catch (error) {
        console.error("Failed to unlink Google:", error);
        toast.error("Failed to disconnect Google account");
      }
    }
  };

  // Load profile data
  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;

      setIsLoadingProfile(true);
      try {
        // Try to load from Supabase first
        const supabaseProfile = await getCreatorByDID(user.id);

        if (supabaseProfile) {
          setCreator(transformSupabaseCreator(supabaseProfile));
          setFormData({
            displayName: supabaseProfile.display_name,
            handle: supabaseProfile.handle,
            description: supabaseProfile.description || "",
            website: supabaseProfile.website || "",
            instagramHandle: supabaseProfile.instagram_handle || user?.instagram?.username || "",
            tiktokHandle: supabaseProfile.tiktok_handle || user?.tiktok?.username || "",
          });
          setBannerPreview(supabaseProfile.banner || null);
          setAvatarPreview(supabaseProfile.avatar || "");
          return;
        }
      } catch (error) {
        console.warn("Could not load from Supabase, checking fallback:", error);
      } finally {
        // CRITICAL FIX: Always clear loading state, even on success
        setIsLoadingProfile(false);
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
            instagramHandle: profileData.instagramHandle || user?.instagram?.username || "",
            tiktokHandle: profileData.tiktokHandle || user?.tiktok?.username || "",
          });
          setBannerPreview(profileData.banner || null);
          setAvatarPreview(profileData.avatar || user?.twitter?.profilePictureUrl || "/defaultpfp.png");
          console.log("Loaded profile from fallback storage");
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
        avatar: user?.twitter?.profilePictureUrl || "/defaultpfp.png",
        description: "Welcome to my Dragverse profile!",
        followerCount: 0,
        followingCount: 0,
        createdAt: new Date(user.createdAt || Date.now()),
        verified: false,
      };
      setCreator(defaultCreator);
      setFormData({
        displayName: defaultCreator.displayName,
        handle: defaultCreator.handle,
        description: defaultCreator.description,
        website: "",
        instagramHandle: user?.instagram?.username || "",
        tiktokHandle: user?.tiktok?.username || "",
      });
      setAvatarPreview(defaultCreator.avatar);
    }

    if (isAuthenticated) {
      loadProfile();
    }
  }, [isAuthenticated, user?.id]);

  // Load Bluesky session status and profile
  useEffect(() => {
    async function checkBlueskySession() {
      try {
        const response = await fetch("/api/bluesky/session");
        const data = await response.json();

        if (data.connected) {
          setBlueskyHandle(data.handle);

          // FIX: Add timeout and error handling to prevent infinite loading
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const profileResponse = await fetch("/api/bluesky/profile", {
              signal: controller.signal
            });
            clearTimeout(timeout);

            if (profileResponse.ok) {
              const profileData = await profileResponse.json();
              if (profileData.success && profileData.profile) {
                setBlueskyProfile(profileData.profile);
              }
            } else {
              console.warn("Bluesky profile fetch failed with status:", profileResponse.status);
            }
          } catch (profileError) {
            console.warn("Bluesky profile fetch failed (non-critical):", profileError);
            // Continue without Bluesky profile - don't block settings page
          }
        }
      } catch (error) {
        console.error("Failed to check Bluesky session:", error);
      }
    }

    if (isAuthenticated) {
      checkBlueskySession();
    }
  }, [isAuthenticated]);

  // Safety timeout: ensure loading state always clears within 10 seconds
  useEffect(() => {
    if (!isLoadingProfile) return;

    const timeout = setTimeout(() => {
      if (isLoadingProfile) {
        console.warn("Profile loading timed out after 10 seconds, clearing spinner");
        setIsLoadingProfile(false);
      }
    }, 10000); // 10 second max wait

    return () => clearTimeout(timeout);
  }, [isLoadingProfile]);

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
      toast.error("Dragverse username is required");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(formData.handle)) {
      toast.error("Username can only contain lowercase letters, numbers, and underscores");
      return;
    }

    if (formData.handle.length < 3) {
      toast.error("Username must be at least 3 characters long");
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

      // Get authentication token from Privy
      if (!user?.id) {
        throw new Error("User not found. Please log in again.");
      }

      const token = await getAccessToken();
      console.log("[Settings] Got access token:", token ? "✓ Valid" : "✗ Null");

      if (!token) {
        throw new Error("Authentication required. Please log in again.");
      }

      console.log("[Settings] Saving profile for user:", user.id);

      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          did: user.id, // CRITICAL: Include user DID for upsert to work
          handle: formData.handle,
          displayName: formData.displayName,
          description: formData.description,
          avatar: avatarUrl,
          banner: bannerUrl,
          website: formData.website || undefined,
          instagramHandle: formData.instagramHandle || undefined,
          tiktokHandle: formData.tiktokHandle || undefined,
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
            setCreator(transformSupabaseCreator(updated));
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

  const handleSyncProfile = async () => {
    if (!user) {
      toast.error("You must be logged in to sync profile");
      return;
    }

    setIsSyncing(true);
    const loadingToast = toast.loading("Syncing profile with Privy...");

    try {
      // Get Privy access token
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No authentication token found. Please log in again.");
      }

      const response = await fetch("/api/creator/sync-profile", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      toast.dismiss(loadingToast);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to sync profile");
      }

      const result = await response.json();

      toast.success("Profile synced successfully!");
      console.log("Synced profile:", result.creator);

      // Update form data with synced values
      setFormData({
        displayName: result.creator.displayName || formData.displayName,
        handle: result.creator.handle || formData.handle,
        description: formData.description, // Keep user's description
        website: formData.website,
        instagramHandle: formData.instagramHandle,
        tiktokHandle: formData.tiktokHandle,
      });

      // Update avatar preview
      if (result.creator.avatar) {
        setAvatarPreview(result.creator.avatar);
      }

      // Reload profile
      if (user?.id) {
        try {
          const updated = await getCreatorByDID(user.id);
          if (updated) {
            setCreator(transformSupabaseCreator(updated));
          }
        } catch (error) {
          console.warn("Could not reload profile:", error);
        }
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Profile sync error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to sync profile"
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectBluesky = async () => {
    // Validation
    if (!blueskyHandleInput.trim() || !appPasswordInput.trim()) {
      toast.error("Please enter both handle and app password");
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    const toastId = toast.loading("Testing connection to Bluesky...");

    try {
      const response = await fetch("/api/bluesky/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: blueskyHandleInput.trim(),
          appPassword: appPasswordInput.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.dismiss(toastId);

        // Show specific error based on type
        let errorMessage = data.error;

        if (data.errorType === "INVALID_HANDLE") {
          errorMessage = "Invalid handle format. Use: username.bsky.social";
        } else if (data.errorType === "INVALID_PASSWORD") {
          errorMessage = "Invalid credentials. Create app password at bsky.app/settings/app-passwords";
        }

        setConnectionError(errorMessage);
        toast.error(errorMessage, { duration: 5000 });
        return;
      }

      // Success!
      toast.dismiss(toastId);
      toast.success(`Connected as @${data.handle}!`, { duration: 4000 });

      // Clear old localStorage credentials
      try {
        const profile = getLocalProfile();
        if (profile) {
          delete profile.blueskyHandle;
          delete profile.blueskyAppPassword;
          saveLocalProfile(profile);
        }
      } catch (e) {
        // Ignore errors
      }

      setBlueskyHandle(data.handle);

      // Clear cache and fetch fresh profile data
      clearBlueskyCache();

      try {
        const profileResponse = await fetch("/api/bluesky/profile");
        const profileData = await profileResponse.json();

        if (profileData.success && profileData.profile) {
          setBlueskyProfile(profileData.profile);
        }
      } catch (error) {
        console.error("Failed to fetch profile data:", error);
      }

      setShowBlueskyModal(false);
      setBlueskyHandleInput("");
      setAppPasswordInput("");
      setConnectionError(null);
    } catch (error) {
      toast.dismiss(toastId);
      setConnectionError("Network error. Check your connection.");
      toast.error("Network error. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectBluesky = async () => {
    try {
      const response = await fetch("/api/bluesky/session", {
        method: "DELETE",
      });

      if (response.ok) {
        // Also clear old localStorage if present
        try {
          const profile = getLocalProfile();
          if (profile) {
            delete profile.blueskyHandle;
            delete profile.blueskyAppPassword;
            saveLocalProfile(profile);
          }
        } catch (e) {
          // Ignore errors
        }

        // Clear the cache so the hook refetches
        clearBlueskyCache();

        setBlueskyHandle(null);
        setBlueskyProfile(null);
        toast.success("Bluesky account disconnected");
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (error) {
      toast.error("Failed to disconnect Bluesky account");
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

                {/* Dragverse Username */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2 text-gray-300">
                    Dragverse Username *
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    This is your unique username across the Dragverse platform
                  </p>
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
                          handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                        }))
                      }
                      disabled={isSaving}
                      className="w-full pl-8 pr-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition disabled:opacity-50"
                      placeholder="yourhandle"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.handle.length}/50 characters (letters, numbers, and underscores only)
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

                {/* Instagram Handle */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-2 text-gray-300">
                    Instagram Handle
                    {user?.instagram?.username && (
                      <span className="ml-2 text-xs text-gray-500">
                        (from connected account)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    value={formData.instagramHandle}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, instagramHandle: e.target.value }))
                    }
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition disabled:opacity-50"
                    placeholder="username (without @)"
                  />
                </div>

                {/* TikTok Handle */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-2 text-gray-300">
                    TikTok Handle
                    {user?.tiktok?.username && (
                      <span className="ml-2 text-xs text-gray-500">
                        (from connected account)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    value={formData.tiktokHandle}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, tiktokHandle: e.target.value }))
                    }
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition disabled:opacity-50"
                    placeholder="username (without @)"
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {/* Import from Connected Accounts Button */}
                  <button
                    onClick={handleSyncProfile}
                    disabled={isSyncing || isSaving}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#6c2bd9] to-[#EB83EA] hover:from-[#5c1bc9] hover:to-[#E748E6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 border border-white/10"
                    title="Import your profile info from connected social accounts"
                  >
                    <FiUser className="w-4 h-4" />
                    {isSyncing ? "Importing..." : "Import from Connected Accounts"}
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    Pull your profile info from Twitter, Google, Farcaster, and other connected social accounts. Your custom uploaded images will be preserved.
                  </p>

                  {/* Save Button */}
                  <button
                    onClick={handleSave}
                    disabled={isSaving || isSyncing}
                    className="w-full px-6 py-4 bg-[#EB83EA] hover:bg-[#E748E6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full transition-colors flex items-center justify-center gap-2"
                  >
                    <FiSave className="w-5 h-5" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            )}

            {activeSection === "accounts" && (
              <div>
                <h2 className="text-2xl font-bold text-[#FCF1FC] mb-6">
                  Connected Accounts
                </h2>
                <p className="text-gray-400 mb-6">
                  Connect your social accounts to display them on your profile and cross-post your content.
                </p>

                <div className="space-y-4">
                  {/* Wallets Section */}
                  {wallets && wallets.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-[#FCF1FC] mb-3">Wallets</h3>
                      <div className="space-y-3">
                        {wallets.map((wallet, index) => (
                          <div
                            key={wallet.address}
                            className="flex items-center justify-between p-4 bg-[#0f071a] rounded-xl border border-[#2f2942]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#EB83EA] flex items-center justify-center">
                                <span className="text-white font-bold text-lg">W</span>
                              </div>
                              <div>
                                <p className="font-semibold">{getWalletType(wallet)}</p>
                                <p className="text-sm text-gray-400 font-mono">
                                  {formatAddress(wallet.address)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {index === 0 && (
                                <span className="text-xs px-3 py-1 bg-[#EB83EA]/10 text-[#EB83EA] rounded-full">
                                  PRIMARY
                                </span>
                              )}
                              <button
                                onClick={() => copyToClipboard(wallet.address)}
                                className="text-sm px-3 py-1 text-gray-400 hover:text-white border border-[#2f2942] hover:border-[#EB83EA] rounded-lg transition"
                              >
                                Copy
                              </button>
                              {wallets.length > 1 && (
                                <button
                                  onClick={() => handleUnlinkWallet(wallet.address)}
                                  className="text-sm px-3 py-1 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500 rounded-lg transition"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleLinkWallet}
                        className="mt-3 w-full px-4 py-3 bg-[#18122D] hover:bg-[#2f2942] border border-[#2f2942] hover:border-[#EB83EA] rounded-xl transition text-[#FCF1FC] font-semibold"
                      >
                        + Link New Wallet
                      </button>
                    </div>
                  )}

                  {/* Email Account */}
                  {emailAccount && (
                    <div className="flex items-center justify-between p-4 bg-[#0f071a] rounded-xl border border-[#2f2942]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">@</span>
                        </div>
                        <div>
                          <p className="font-semibold">Email</p>
                          <p className="text-sm text-gray-400">{emailAccount.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-3 py-1 bg-green-500/10 text-green-500 rounded-full">
                          Connected
                        </span>
                        {canUnlinkAccount() && (
                          <button
                            onClick={handleUnlinkEmail}
                            className="text-sm px-3 py-1 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500 rounded-lg transition"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Google Account */}
                  {googleAccount && (
                    <div className="flex items-center justify-between p-4 bg-[#0f071a] rounded-xl border border-[#2f2942]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">G</span>
                        </div>
                        <div>
                          <p className="font-semibold">Google</p>
                          <p className="text-sm text-gray-400">{googleAccount.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-3 py-1 bg-green-500/10 text-green-500 rounded-full">
                          Connected
                        </span>
                        {canUnlinkAccount() && (
                          <button
                            onClick={handleUnlinkGoogle}
                            className="text-sm px-3 py-1 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500 rounded-lg transition"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  )}

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
                    <div className="flex flex-col items-end gap-1">
                      {farcasterHandle && (
                        <span className="text-xs px-3 py-1 bg-green-500/10 text-green-500 rounded-full">
                          Connected
                        </span>
                      )}
                      <p className="text-xs text-gray-500">Via Privy</p>
                    </div>
                  </div>

                  {/* Bluesky */}
                  <div className="flex items-center justify-between p-4 bg-[#0f071a] rounded-xl border border-[#2f2942]">
                    <div className="flex items-center gap-3">
                      {blueskyProfile?.avatar ? (
                        <Image
                          src={blueskyProfile.avatar}
                          alt="Bluesky avatar"
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                          <SiBluesky className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold">
                          {blueskyProfile?.displayName || "Bluesky"}
                        </p>
                        {blueskyHandle ? (
                          <>
                            <p className="text-sm text-gray-400">@{blueskyHandle}</p>
                            {blueskyProfile && (
                              <p className="text-xs text-gray-500">
                                {blueskyProfile.followersCount} followers · {blueskyProfile.followsCount} following
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">Not connected</p>
                        )}
                      </div>
                    </div>
                    {blueskyHandle ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-3 py-1 bg-green-500/10 text-green-500 rounded-full">
                          Connected
                        </span>
                        <button
                          onClick={handleDisconnectBluesky}
                          className="text-xs px-3 py-1 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500/20 transition"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowBlueskyModal(true)}
                        className="text-sm px-4 py-2 bg-[#EB83EA] hover:bg-[#E748E6] rounded-lg transition font-semibold"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <p className="text-sm text-blue-400 mb-2">
                    <strong>Wallets:</strong> Connect crypto wallets (MetaMask, Coinbase Wallet, WalletConnect) via Privy
                  </p>
                  <p className="text-sm text-blue-400 mb-2">
                    <strong>Email & Google:</strong> Connect via Privy when logging in or using the link button
                  </p>
                  <p className="text-sm text-blue-400 mb-2">
                    <strong>Farcaster:</strong> Connect via Privy when logging in (sign in with Farcaster)
                  </p>
                  <p className="text-sm text-blue-400">
                    <strong>Bluesky:</strong> Connect manually using the button above with your Bluesky app password
                  </p>
                </div>

                {/* Bluesky Connection Modal */}
                {showBlueskyModal && (
                  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a0b2e] border border-[#2f2942] rounded-xl p-6 max-w-md w-full">
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                        <SiBluesky className="w-6 h-6 text-blue-500" />
                        Connect Bluesky Account
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Bluesky Handle
                          </label>
                          <input
                            type="text"
                            placeholder="username.bsky.social"
                            value={blueskyHandleInput}
                            onChange={(e) => setBlueskyHandleInput(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-lg focus:outline-none focus:border-[#EB83EA] transition"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            App Password
                          </label>
                          <input
                            type="password"
                            placeholder="xxxx-xxxx-xxxx-xxxx"
                            value={appPasswordInput}
                            onChange={(e) => setAppPasswordInput(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-lg focus:outline-none focus:border-[#EB83EA] transition"
                          />
                        </div>

                        {connectionError && (
                          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                            <p className="text-sm text-red-400">{connectionError}</p>
                          </div>
                        )}

                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                          <p className="text-xs text-blue-400">
                            Create an app password at{" "}
                            <a
                              href="https://bsky.app/settings/app-passwords"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-blue-300"
                            >
                              bsky.app/settings/app-passwords
                            </a>
                          </p>
                        </div>

                        <div className="flex gap-3 mt-6">
                          <button
                            onClick={handleConnectBluesky}
                            disabled={isConnecting || !blueskyHandleInput.trim() || !appPasswordInput.trim()}
                            className="flex-1 py-3 bg-[#EB83EA] hover:bg-[#E748E6] rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            {isConnecting ? "Testing Connection..." : "Connect"}
                          </button>
                          <button
                            onClick={() => {
                              setShowBlueskyModal(false);
                              setBlueskyHandleInput("");
                              setAppPasswordInput("");
                              setConnectionError(null);
                            }}
                            disabled={isConnecting}
                            className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
