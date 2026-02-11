"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiUser, FiLink2, FiUpload, FiSave, FiArrowLeft, FiAlertTriangle, FiShare2, FiDollarSign } from "react-icons/fi";
import { SiBluesky, SiYoutube } from "react-icons/si";
import Image from "next/image";
import toast from "react-hot-toast";
import { useAuthUser } from "@/lib/privy/hooks";
import { usePrivy, useFundWallet } from "@privy-io/react-auth";
import { Creator } from "@/types";
import { uploadBanner, uploadAvatar, getImageDataURL } from "@/lib/livepeer/upload-image";
import { getCreatorByDID } from "@/lib/supabase/creators";
import { transformSupabaseCreator } from "@/lib/supabase/transformers";
import { saveLocalProfile, getLocalProfile } from "@/lib/utils/local-storage";
import { clearBlueskyCache } from "@/lib/bluesky/hooks";

export default function SettingsPage() {
  const router = useRouter();
  const { getAccessToken, logout } = usePrivy();
  const { fundWallet } = useFundWallet();
  const {
    isAuthenticated,
    isReady,
    userHandle,
    userEmail,
    user,
    wallets,
    emailAccount,
    googleAccount,
    linkWallet,
    linkEmail,
    linkGoogle,
    unlinkWallet,
    unlinkEmail,
    unlinkGoogle,
  } = useAuthUser();

  const [activeSection, setActiveSection] = useState<"profile" | "accounts" | "wallet" | "crosspost" | "danger">("profile");
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  // YouTube OAuth state
  const [youtubeChannelName, setYoutubeChannelName] = useState<string | null>(null);
  const [youtubeSubscriberCount, setYoutubeSubscriberCount] = useState<number>(0);
  const [youtubeSyncedAt, setYoutubeSyncedAt] = useState<string | null>(null);
  const [isConnectingYouTube, setIsConnectingYouTube] = useState(false);

  // Delete account state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Crosspost settings state
  const [crosspostSettings, setCrosspostSettings] = useState({
    bluesky: false,
  });
  const [connectedPlatforms, setConnectedPlatforms] = useState({
    bluesky: false,
  });
  const [isSavingCrosspost, setIsSavingCrosspost] = useState(false);

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

          // Load YouTube channel info if connected (use raw database fields)
          if ((supabaseProfile as any).youtube_channel_name) {
            setYoutubeChannelName((supabaseProfile as any).youtube_channel_name);
            setYoutubeSubscriberCount((supabaseProfile as any).youtube_subscriber_count || 0);
            setYoutubeSyncedAt((supabaseProfile as any).youtube_synced_at);
          }

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
            // Show toast so user knows their Bluesky profile data may be stale
            toast.error("Could not load Bluesky profile details. Some data may be outdated.", { duration: 4000 });
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


  // Load crosspost settings
  useEffect(() => {
    async function loadCrosspostSettings() {
      if (!isAuthenticated) return;

      try {
        const token = await getAccessToken();
        const response = await fetch("/api/user/crosspost-settings", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCrosspostSettings(data.settings);
            setConnectedPlatforms(data.connected);
          }
        }
      } catch (error) {
        console.error("Failed to load crosspost settings:", error);
      }
    }

    loadCrosspostSettings();
  }, [isAuthenticated, getAccessToken]);

  // Handle YouTube OAuth callback
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const youtubeSuccess = urlParams.get('youtube_success');
    const youtubeError = urlParams.get('youtube_error');
    const channelName = urlParams.get('channel');
    const subscribers = urlParams.get('subscribers');

    if (youtubeSuccess === 'true' && channelName) {
      toast.success(
        `Connected ${decodeURIComponent(channelName)}! Imported ${parseInt(subscribers || '0').toLocaleString()} subscribers.`,
        { duration: 5000 }
      );
      setIsConnectingYouTube(false);
      setYoutubeChannelName(decodeURIComponent(channelName));
      setYoutubeSubscriberCount(parseInt(subscribers || '0'));
      setYoutubeSyncedAt(new Date().toISOString());
      // Clean up URL
      window.history.replaceState({}, '', '/settings?tab=accounts');
    } else if (youtubeError) {
      const errorMessages: Record<string, string> = {
        denied: "YouTube authorization was cancelled",
        no_code: "No authorization code received from YouTube",
        token_exchange_failed: "Failed to exchange authorization code",
        unknown: "An unknown error occurred",
      };
      toast.error(
        errorMessages[youtubeError] || decodeURIComponent(youtubeError),
        { duration: 5000 }
      );
      setIsConnectingYouTube(false);
      // Clean up URL
      window.history.replaceState({}, '', '/settings?tab=accounts');
    }
  }, []);

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

      // Get authentication token from Privy (needed for image uploads)
      if (!user?.id) {
        throw new Error("User not found. Please log in again.");
      }

      const token = await getAccessToken();
      console.log("[Settings] Got access token:", token ? "✓ Valid" : "✗ Null");

      if (!token) {
        throw new Error("Authentication required. Please log in again.");
      }

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

      // Save profile via API route (with fallback support)
      toast.loading("Saving profile...");
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

  // YouTube OAuth handlers
  const handleConnectYouTube = async () => {
    setIsConnectingYouTube(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      // Get OAuth URL from backend
      const response = await fetch("/api/youtube/connect", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to generate OAuth URL");
      }

      const data = await response.json();

      // Redirect to Google OAuth consent screen
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("YouTube connect error:", error);
      toast.error("Failed to connect YouTube. Please try again.");
      setIsConnectingYouTube(false);
    }
  };

  const handleDisconnectYouTube = async () => {
    if (!confirm("Disconnect your YouTube channel? This will remove imported subscribers.")) {
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch("/api/youtube/connect", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect YouTube channel");
      }

      setYoutubeChannelName(null);
      setYoutubeSubscriberCount(0);
      setYoutubeSyncedAt(null);
      toast.success("YouTube channel disconnected");
    } catch (error) {
      console.error("YouTube disconnect error:", error);
      toast.error("Failed to disconnect YouTube channel");
    }
  };

  const handleResyncYouTube = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const toastId = toast.loading("Re-syncing YouTube channel...");

      const response = await fetch("/api/youtube/connect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to re-sync channel");
      }

      const data = await response.json();

      setYoutubeChannelName(data.channelInfo.channelName);
      setYoutubeSubscriberCount(data.channelInfo.subscriberCount);
      setYoutubeSyncedAt(new Date().toISOString());

      toast.success(
        `Re-synced ${data.channelInfo.channelName}! Updated to ${data.channelInfo.subscriberCount.toLocaleString()} subscribers.`,
        { id: toastId }
      );
    } catch (error) {
      console.error("YouTube re-sync error:", error);
      toast.error("Failed to re-sync YouTube channel");
    }
  };

  const handleSaveCrosspostSettings = async () => {
    setIsSavingCrosspost(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Authentication required. Please log in again.");
      }

      const response = await fetch("/api/user/crosspost-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(crosspostSettings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save settings");
      }

      const result = await response.json();
      if (result.success) {
        toast.success("Cross-posting preferences saved!");
      } else {
        throw new Error(result.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save crosspost settings:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings"
      );
    } finally {
      setIsSavingCrosspost(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast.error('Please type "DELETE" to confirm');
      return;
    }

    const finalConfirm = confirm(
      "Are you absolutely sure? This action cannot be undone. All your content, followers, and data will be permanently deleted."
    );

    if (!finalConfirm) {
      return;
    }

    setIsDeleting(true);
    const loadingToast = toast.loading("Deleting your account...");

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Authentication required. Please log in again.");
      }

      const response = await fetch("/api/user/delete-account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      toast.dismiss(loadingToast);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete account");
      }

      toast.success("Account deleted successfully. Logging out...");

      // IMPORTANT: Log out of Privy to clear session completely
      await logout();

      // Redirect to home after logout
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Account deletion error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete account"
      );
      setIsDeleting(false);
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
            <button
              onClick={() => setActiveSection("wallet")}
              className={`w-full px-4 py-3 rounded-lg text-left flex items-center gap-3 transition ${
                activeSection === "wallet"
                  ? "bg-[#EB83EA] text-white"
                  : "bg-[#18122D] text-gray-400 hover:text-white hover:bg-[#2f2942]"
              }`}
            >
              <FiDollarSign className="w-5 h-5" />
              Wallet
            </button>
            <button
              onClick={() => setActiveSection("crosspost")}
              className={`w-full px-4 py-3 rounded-lg text-left flex items-center gap-3 transition ${
                activeSection === "crosspost"
                  ? "bg-[#EB83EA] text-white"
                  : "bg-[#18122D] text-gray-400 hover:text-white hover:bg-[#2f2942]"
              }`}
            >
              <FiShare2 className="w-5 h-5" />
              Cross-Posting
            </button>
            <button
              onClick={() => setActiveSection("danger")}
              className={`w-full px-4 py-3 rounded-lg text-left flex items-center gap-3 transition ${
                activeSection === "danger"
                  ? "bg-red-500 text-white"
                  : "bg-[#18122D] text-gray-400 hover:text-white hover:bg-[#2f2942]"
              }`}
            >
              <FiAlertTriangle className="w-5 h-5" />
              Danger Zone
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
                <div className="mt-6">
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
              </div>
            )}

            {activeSection === "crosspost" && (
              <div>
                <h2 className="text-2xl font-bold text-[#FCF1FC] mb-6">
                  Cross-Posting Settings
                </h2>
                <p className="text-gray-400 mb-6">
                  Set your default platforms for cross-posting. You can override these settings when creating individual posts.
                </p>

                <div className="space-y-4">
                  {/* Bluesky Toggle */}
                  <div className="p-4 bg-[#0f071a] rounded-xl border border-[#2f2942]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                          <SiBluesky className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold">Bluesky</p>
                          <p className="text-sm text-gray-400">
                            {connectedPlatforms.bluesky
                              ? `Connected as @${blueskyHandle}`
                              : "Not connected"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {connectedPlatforms.bluesky ? (
                          <>
                            <span className="text-xs px-3 py-1 bg-green-500/10 text-green-500 rounded-full">
                              Connected
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={crosspostSettings.bluesky}
                                onChange={(e) =>
                                  setCrosspostSettings((prev) => ({
                                    ...prev,
                                    bluesky: e.target.checked,
                                  }))
                                }
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#EB83EA]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#EB83EA]"></div>
                            </label>
                          </>
                        ) : (
                          <button
                            onClick={() => setActiveSection("accounts")}
                            className="text-sm px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-500 rounded-lg transition font-semibold"
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <p className="text-sm text-blue-400 mb-2">
                    <strong>Default Cross-Posting:</strong> When enabled, your posts will automatically be shared to the selected platforms.
                  </p>
                  <p className="text-sm text-blue-400">
                    You can override these defaults when creating individual posts in the composer.
                  </p>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveCrosspostSettings}
                  disabled={isSavingCrosspost}
                  className="mt-6 w-full px-6 py-4 bg-[#EB83EA] hover:bg-[#E748E6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full transition-colors flex items-center justify-center gap-2"
                >
                  <FiSave className="w-5 h-5" />
                  {isSavingCrosspost ? "Saving..." : "Save Cross-Posting Preferences"}
                </button>
              </div>
            )}

            {activeSection === "wallet" && (
              <div>
                <h2 className="text-2xl font-bold text-[#FCF1FC] mb-6">
                  Wallet
                </h2>
                <p className="text-gray-400 mb-6">
                  Manage your crypto wallet for tipping creators and receiving payments.
                </p>

                {/* Wallet Address Section */}
                {wallets && wallets.length > 0 ? (
                  <div className="space-y-6">
                    {/* Primary Wallet Card */}
                    <div className="bg-gradient-to-br from-[#EB83EA]/20 to-purple-900/20 border border-[#EB83EA]/30 rounded-xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-[#FCF1FC] mb-1">Your Wallet</h3>
                          <p className="text-sm text-gray-400">{getWalletType(wallets[0])}</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-[#EB83EA] flex items-center justify-center">
                          <FiDollarSign className="w-6 h-6 text-white" />
                        </div>
                      </div>

                      <div className="bg-[#0f071a] rounded-lg p-4 mb-4">
                        <label className="block text-xs text-gray-400 mb-2">Wallet Address</label>
                        <div className="flex items-center justify-between gap-3">
                          <code className="text-sm font-mono text-white flex-1 truncate">
                            {wallets[0].address}
                          </code>
                          <button
                            onClick={() => copyToClipboard(wallets[0].address)}
                            className="px-3 py-1.5 bg-[#EB83EA] hover:bg-[#E748E6] rounded-lg text-xs font-semibold transition"
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#0f071a] rounded-lg p-4">
                          <label className="block text-xs text-gray-400 mb-1">Network</label>
                          <p className="text-sm font-semibold text-white">Base</p>
                        </div>
                        <div className="bg-[#0f071a] rounded-lg p-4">
                          <label className="block text-xs text-gray-400 mb-1">Status</label>
                          <p className="text-sm font-semibold text-green-400">Connected</p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-[#0f071a] rounded-xl border border-[#2f2942] p-6">
                      <h3 className="text-lg font-bold text-[#FCF1FC] mb-4">Quick Actions</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                          onClick={async () => {
                            try {
                              const wallet = wallets[0];
                              if (wallet && 'address' in wallet) {
                                await fundWallet({
                                  address: wallet.address as string,
                                  options: {
                                    chain: { id: 8453 }, // Base network
                                    asset: "USDC",
                                    amount: "10", // Default amount
                                  }
                                });
                              } else {
                                toast.error("No wallet address found");
                              }
                            } catch (error) {
                              console.error("Fund wallet error:", error);
                              toast.error(`Failed to open funding modal: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            }
                          }}
                          className="px-4 py-3 bg-[#EB83EA] hover:bg-[#E748E6] rounded-lg font-semibold transition flex flex-col items-center justify-center"
                        >
                          <div className="flex items-center gap-2">
                            <FiDollarSign className="w-4 h-4" />
                            Add Funds
                          </div>
                          <span className="text-xs text-white/80 mt-0.5">Top up to support your faves</span>
                        </button>
                        <button
                          onClick={() => {
                            window.open(`https://basescan.org/address/${wallets[0].address}`, '_blank');
                          }}
                          className="px-4 py-3 bg-[#2f2942] hover:bg-[#3f3952] rounded-lg font-semibold transition flex items-center justify-center gap-2"
                        >
                          View on Explorer
                        </button>
                      </div>
                    </div>

                    {/* Additional Wallets */}
                    {wallets.length > 1 && (
                      <div className="bg-[#0f071a] rounded-xl border border-[#2f2942] p-6">
                        <h3 className="text-lg font-bold text-[#FCF1FC] mb-4">Additional Wallets</h3>
                        <div className="space-y-3">
                          {wallets.slice(1).map((wallet) => (
                            <div
                              key={wallet.address}
                              className="flex items-center justify-between p-4 bg-[#18122D] rounded-lg"
                            >
                              <div>
                                <p className="font-semibold text-sm">{getWalletType(wallet)}</p>
                                <p className="text-xs text-gray-400 font-mono mt-1">
                                  {formatAddress(wallet.address)}
                                </p>
                              </div>
                              <button
                                onClick={() => copyToClipboard(wallet.address)}
                                className="text-sm px-3 py-1 text-gray-400 hover:text-white border border-[#2f2942] hover:border-[#EB83EA] rounded-lg transition"
                              >
                                Copy
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transaction History */}
                    <div className="bg-[#0f071a] rounded-xl border border-[#2f2942] p-6">
                      <h3 className="text-lg font-bold text-[#FCF1FC] mb-4">Recent Transactions</h3>
                      <div className="space-y-3">
                        {/* Empty State - To be replaced with actual transaction data */}
                        <div className="text-center py-8">
                          <div className="w-12 h-12 rounded-full bg-[#2f2942] flex items-center justify-center mx-auto mb-3">
                            <FiDollarSign className="w-6 h-6 text-gray-400" />
                          </div>
                          <p className="text-sm text-gray-400 mb-2">No transactions yet</p>
                          <p className="text-xs text-gray-500">
                            Your tipping activity will appear here
                          </p>
                        </div>

                        {/* Example transaction items (to be implemented with real data) */}
                        {/* <div className="flex items-center justify-between p-4 bg-[#18122D] rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                              <span className="text-green-400 text-sm">↓</span>
                            </div>
                            <div>
                              <p className="font-semibold text-sm">Received Tip</p>
                              <p className="text-xs text-gray-400">From @username</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-400">+$10.00</p>
                            <p className="text-xs text-gray-500">2 hours ago</p>
                          </div>
                        </div> */}
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                      <p className="text-sm text-blue-400 mb-2">
                        <strong>Tipping:</strong> Use your wallet to send tips to creators you support. Tips are sent via Base network.
                      </p>
                      <p className="text-sm text-blue-400">
                        <strong>Security:</strong> Your wallet is managed by Privy. Never share your private keys or seed phrase.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-[#2f2942] flex items-center justify-center mx-auto mb-4">
                      <FiDollarSign className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-[#FCF1FC] mb-2">Connect your wallet to tip creators you love ✨</h3>
                    <p className="text-gray-400 mb-6">
                      Support your faves and receive tips from your community
                    </p>
                    <button
                      onClick={handleLinkWallet}
                      className="px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] rounded-lg font-semibold transition inline-flex items-center gap-2"
                    >
                      <FiLink2 className="w-4 h-4" />
                      Connect Wallet
                    </button>
                  </div>
                )}
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

                  {/* YouTube Channel */}
                  <div className="p-4 bg-[#0f071a] rounded-xl border border-[#2f2942]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                          <SiYoutube className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                          <p className="font-semibold">YouTube Channel</p>
                          {youtubeChannelName ? (
                            <>
                              <p className="text-sm text-gray-400">{youtubeChannelName}</p>
                              <p className="text-xs text-gray-500">
                                {youtubeSubscriberCount.toLocaleString()} subscribers
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-500">Not connected</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {youtubeChannelName ? (
                          <>
                            <span className="text-xs px-3 py-1 bg-green-500/10 text-green-500 rounded-full">
                              Connected
                            </span>
                            <button
                              onClick={handleDisconnectYouTube}
                              className="text-sm px-3 py-1 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500 rounded-lg transition"
                            >
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={handleConnectYouTube}
                            disabled={isConnectingYouTube}
                            className="text-sm px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500 rounded-lg transition font-semibold disabled:opacity-50"
                          >
                            {isConnectingYouTube ? "Connecting..." : "Connect Channel"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Import Subscribers Info */}
                    {youtubeChannelName && (
                      <div className="pt-3 border-t border-[#2f2942]">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-300">
                              Subscribers Imported
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Your {youtubeSubscriberCount.toLocaleString()} YouTube subscribers are reflected in your Dragverse follower count.
                              {youtubeSyncedAt && (
                                <> Last synced: {new Date(youtubeSyncedAt).toLocaleDateString()}</>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={handleResyncYouTube}
                            className="text-xs px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full hover:bg-purple-500/20 transition flex-shrink-0"
                          >
                            Re-sync
                          </button>
                        </div>
                      </div>
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
                    <strong>Bluesky:</strong> Connect manually using the button above with your Bluesky app password
                  </p>
                  <p className="text-sm text-blue-400">
                    <strong>YouTube:</strong> Connect via Google OAuth to import your subscriber count as Dragverse followers
                  </p>
                </div>
              </div>
            )}

            {activeSection === "danger" && (
              <div>
                <h2 className="text-2xl font-bold text-red-400 mb-6 flex items-center gap-2">
                  <FiAlertTriangle className="w-6 h-6" />
                  Danger Zone
                </h2>
                <p className="text-gray-400 mb-6">
                  Irreversible and destructive actions
                </p>

                {/* Delete Account Section */}
                <div className="border-2 border-red-500/30 rounded-xl p-6 bg-red-500/5">
                  <h3 className="text-xl font-bold text-red-400 mb-3">
                    Delete Account
                  </h3>
                  <p className="text-gray-300 mb-4">
                    Once you delete your account, there is no going back. This action will:
                  </p>
                  <ul className="list-disc list-inside text-gray-400 mb-6 space-y-2">
                    <li>Permanently delete all your videos, audio, and posts</li>
                    <li>Remove all your comments and interactions</li>
                    <li>Delete your profile and follower connections</li>
                    <li>Remove all connected social accounts</li>
                    <li>This action cannot be undone</li>
                  </ul>

                  <div className="bg-[#0f071a] border border-red-500/30 rounded-lg p-4 mb-4">
                    <label className="block text-sm font-semibold mb-2 text-red-400">
                      Type "DELETE" to confirm
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      disabled={isDeleting}
                      className="w-full px-4 py-3 bg-[#18122D] border border-red-500/30 rounded-lg focus:outline-none focus:border-red-500 transition text-white disabled:opacity-50"
                    />
                  </div>

                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmText !== "DELETE"}
                    className="w-full px-6 py-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FiAlertTriangle className="w-5 h-5" />
                    {isDeleting ? "Deleting Account..." : "Delete My Account Forever"}
                  </button>

                  <p className="text-xs text-gray-500 text-center mt-3">
                    This action is permanent and cannot be reversed
                  </p>
                </div>
              </div>
            )}

            {activeSection === "accounts" && (
              <div>
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
