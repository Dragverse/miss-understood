"use client";

import { useState, useRef, useEffect } from "react";
import { FiVideo, FiMonitor, FiMic, FiMicOff, FiVideoOff, FiX, FiCopy, FiChevronDown, FiChevronUp } from "react-icons/fi";
import toast from "react-hot-toast";
import { usePrivy } from "@privy-io/react-auth";

interface StreamModalProps {
  onClose: () => void;
}

type StreamStep = 'create' | 'setup' | 'streaming';

interface StreamInfo {
  id: string;
  streamKey: string;
  playbackId: string;
  playbackUrl: string;
  rtmpIngestUrl: string;
  title: string;
}

export function StreamModal({ onClose }: StreamModalProps) {
  const { getAccessToken, user } = usePrivy();

  // Step management
  const [step, setStep] = useState<StreamStep>('create');
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);

  // Stream creation
  const [streamTitle, setStreamTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamType, setStreamType] = useState<'camera' | 'screen' | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [showRTMPDetails, setShowRTMPDetails] = useState(false);

  // Refs for WebRTC
  const setupVideoRef = useRef<HTMLVideoElement>(null);
  const streamingVideoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // User handle for viewer URL
  const [userHandle, setUserHandle] = useState<string>("");

  // Client-side validation
  const validateTitle = (value: string): string => {
    if (value.length === 0) {
      return "Stream name is required";
    }
    if (value.length > 100) {
      return "Stream name must be less than 100 characters";
    }
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(value)) {
      return "Only letters, numbers, spaces, hyphens, and underscores allowed";
    }
    return "";
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStreamTitle(value);
    setTitleError(validateTitle(value));
  };

  // Check for existing active stream on mount
  useEffect(() => {
    const checkExistingStream = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch(`/api/stream/by-creator?creatorDID=${encodeURIComponent(user.id)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.streams && data.streams.length > 0) {
            const activeStream = data.streams[0];

            // Fetch full stream details including stream key
            const authToken = await getAccessToken();
            // Note: We'd need an API endpoint to fetch stream key for existing streams
            // For now, show setup step but user will need to use OBS with existing credentials

            setStreamInfo({
              id: activeStream.id,
              streamKey: "", // Would need to fetch from secure endpoint
              playbackId: activeStream.playbackId,
              playbackUrl: activeStream.playbackUrl,
              rtmpIngestUrl: "", // Would construct from stream key
              title: activeStream.name
            });

            setStep('setup');
            toast("You have an active stream", {
              icon: "ℹ️"
            });
          }
        }
      } catch (error) {
        console.error("Failed to check existing stream:", error);
      }
    };

    checkExistingStream();
  }, [user, getAccessToken]);

  // Fetch user handle for viewer URL
  useEffect(() => {
    const fetchUserHandle = async () => {
      try {
        const authToken = await getAccessToken();
        const response = await fetch("/api/user/me", {
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setUserHandle(data.creator?.handle || "");
        }
      } catch (error) {
        console.error("Failed to fetch user handle:", error);
      }
    };

    if (step === 'setup' || step === 'streaming') {
      fetchUserHandle();
    }
  }, [step, getAccessToken]);

  // Create stream
  const handleCreateStream = async () => {
    const error = validateTitle(streamTitle);
    if (error) {
      setTitleError(error);
      return;
    }

    setIsCreating(true);
    try {
      const authToken = await getAccessToken();
      const response = await fetch("/api/stream/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ name: streamTitle })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 409 && errorData.activeStream) {
          toast.error(`You already have an active stream: "${errorData.activeStream.title}". Please end it first.`, {
            duration: 5000
          });
          throw new Error("Active stream already exists");
        }

        throw new Error(errorData.error || "Failed to create stream");
      }

      const data = await response.json();
      setStreamInfo({
        id: data.id,
        streamKey: data.streamKey,
        playbackId: data.playbackId,
        playbackUrl: data.playbackUrl,
        rtmpIngestUrl: data.rtmpIngestUrl,
        title: streamTitle
      });

      setStep('setup');
      toast.success("Stream created successfully!");
    } catch (error) {
      console.error("Stream creation error:", error);
      if (error instanceof Error && error.message !== "Active stream already exists") {
        toast.error("Failed to create stream: " + error.message);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Camera access
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      mediaStreamRef.current = stream;
      if (setupVideoRef.current) {
        setupVideoRef.current.srcObject = stream;
      }
      setStreamType("camera");
      toast.success("Camera access granted");
    } catch (error) {
      console.error("Camera access error:", error);
      toast.error("Could not access camera. Please check permissions.");
    }
  };

  // Screen share
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      mediaStreamRef.current = stream;
      if (setupVideoRef.current) {
        setupVideoRef.current.srcObject = stream;
      }
      setStreamType("screen");
      toast.success("Screen sharing started");

      // Handle user stopping screen share from browser UI
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopStreaming();
      });
    } catch (error) {
      console.error("Screen share error:", error);
      toast.error("Could not access screen. Please check permissions.");
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (mediaStreamRef.current) {
      const videoTracks = mediaStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoEnabled(!videoEnabled);
    }
  };

  // Start streaming (WebRTC WHIP protocol)
  const startStreaming = async () => {
    if (!mediaStreamRef.current || !streamInfo) {
      toast.error("Please select a video source first");
      return;
    }

    try {
      setIsStreaming(true);
      toast.success("Connecting to Livepeer...");

      // Step 1: Get WebRTC redirect URL (GeoDNS routing to closest server)
      const redirectUrl = `https://livepeer.studio/webrtc/${streamInfo.streamKey}`;
      console.log("📍 Getting WebRTC ingest URL from:", redirectUrl);

      const redirectResponse = await fetch(redirectUrl, {
        method: "HEAD",
        redirect: "manual"
      });

      if (!redirectResponse.ok && redirectResponse.status !== 307) {
        console.error("❌ Failed to get WebRTC redirect:", redirectResponse.status);
        throw new Error(`Failed to connect to Livepeer (${redirectResponse.status}). Please check your stream key.`);
      }

      const ingestUrl = redirectResponse.headers.get("location") || redirectUrl;
      console.log("✅ WebRTC ingest URL:", ingestUrl);

      // Step 2: Extract hostname from ingest URL for Livepeer's STUN/TURN servers
      const ingestHostname = new URL(ingestUrl).hostname;
      console.log("📡 Using Livepeer's ICE servers:", ingestHostname);

      // Step 3: Create RTCPeerConnection with Livepeer's ICE servers
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          {
            urls: `stun:${ingestHostname}`
          },
          {
            urls: `turn:${ingestHostname}`,
            username: "livepeer",
            credential: "livepeer"
          }
        ],
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require"
      });

      peerConnectionRef.current = peerConnection;

      // Add comprehensive debugging listeners
      peerConnection.addEventListener("icecandidate", (event) => {
        if (event.candidate) {
          const type = event.candidate.type;
          const protocol = event.candidate.protocol;
          console.log(`🧊 ICE candidate [${type}/${protocol}]:`, event.candidate.candidate);
        } else {
          console.log("🧊 ICE candidate: gathering complete");
        }
      });

      peerConnection.addEventListener("iceconnectionstatechange", () => {
        console.log("🔌 ICE connection state:", peerConnection.iceConnectionState);
      });

      peerConnection.addEventListener("icegatheringstatechange", () => {
        console.log("🔍 ICE gathering state:", peerConnection.iceGatheringState);
      });

      peerConnection.addEventListener("connectionstatechange", () => {
        console.log("📡 Connection state:", peerConnection.connectionState);
        if (peerConnection.connectionState === "connected") {
          toast.success("Stream connected!");
        } else if (peerConnection.connectionState === "failed") {
          console.error("❌ Connection failed - ICE state:", peerConnection.iceConnectionState);
          toast.error("Stream connection failed");
          stopStreaming();
        } else if (peerConnection.connectionState === "disconnected") {
          console.warn("⚠️ Connection disconnected");
          toast.error("Stream connection lost");
          stopStreaming();
        }
      });

      // Step 4: Add local media tracks to peer connection
      mediaStreamRef.current.getTracks().forEach((track) => {
        if (peerConnectionRef.current && mediaStreamRef.current) {
          peerConnectionRef.current.addTrack(track, mediaStreamRef.current);
        }
      });

      // Step 5: Create SDP offer with sendonly transceivers
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });

      await peerConnection.setLocalDescription(offer);

      // Step 6: Wait for ICE gathering to complete
      // IMPORTANT: For WHIP protocol with ice-lite servers, we should wait for
      // ICE gathering to complete so all candidates are in the SDP offer
      console.log("⏳ Waiting for ICE gathering... Current state:", peerConnection.iceGatheringState);
      await new Promise<void>((resolve) => {
        if (peerConnection.iceGatheringState === "complete") {
          console.log("✅ ICE gathering already complete");
          resolve();
        } else {
          const timeout = setTimeout(() => {
            console.warn("⚠️ ICE gathering timeout, proceeding anyway");
            resolve();
          }, 10000); // Longer timeout to get all candidates

          peerConnection.addEventListener("icegatheringstatechange", () => {
            console.log("🔄 ICE gathering state changed to:", peerConnection.iceGatheringState);
            if (peerConnection.iceGatheringState === "complete") {
              clearTimeout(timeout);
              console.log("✅ ICE gathering completed");
              resolve();
            }
          });
        }
      });

      // Log the final SDP with all gathered candidates
      console.log("📝 Final SDP Offer with ICE candidates:");
      const candidateCount = (peerConnection.localDescription?.sdp?.match(/a=candidate/g) || []).length;
      console.log(`📊 SDP contains ${candidateCount} ICE candidates`);
      console.log(peerConnection.localDescription?.sdp);

      // Step 7: Send SDP offer to Livepeer (WHIP protocol)
      console.log("📤 Sending SDP offer to Livepeer via WHIP...");
      const whipResponse = await fetch(ingestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp"
        },
        body: peerConnection.localDescription?.sdp
      });

      if (!whipResponse.ok) {
        const errorText = await whipResponse.text();
        console.error("❌ WHIP negotiation failed:", whipResponse.status, errorText);
        throw new Error(`WHIP negotiation failed: ${whipResponse.status} - ${errorText}`);
      }

      console.log("✅ WHIP response received:", whipResponse.status);

      // Step 8: Set remote description with server's answer
      const answerSdp = await whipResponse.text();
      console.log("📝 SDP Answer received (full):", answerSdp);

      // Check for Livepeer's ICE candidates
      const serverCandidates = (answerSdp.match(/a=candidate/g) || []).length;
      console.log(`📊 Server provided ${serverCandidates} ICE candidates (ice-lite: ${answerSdp.includes('ice-lite')})`);

      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp
      });

      console.log("✅ Remote description set, waiting for connection...");

      // Monitor connection establishment with timeout
      const connectionTimeout = setTimeout(() => {
        if (peerConnection.connectionState !== "connected") {
          console.error("❌ Connection timeout - state:", peerConnection.connectionState, "ICE:", peerConnection.iceConnectionState);
          toast.error("Connection timeout. Please try again or use OBS/Streamlabs.");
          stopStreaming();
        }
      }, 30000); // 30 second timeout

      // Clear timeout when connection succeeds
      peerConnection.addEventListener("connectionstatechange", () => {
        if (peerConnection.connectionState === "connected") {
          clearTimeout(connectionTimeout);
        }
      }, { once: true });

      setStep('streaming');
      toast.success("🎥 Live on Dragverse!");

    } catch (error) {
      console.error("❌ Streaming error:", error);

      // Provide more specific error guidance
      let errorMessage = "Failed to start stream";
      if (error instanceof Error) {
        if (error.message.includes("WHIP negotiation failed")) {
          errorMessage = "Failed to connect to Livepeer. Please check your internet connection.";
        } else if (error.message.includes("stream key")) {
          errorMessage = "Invalid stream configuration. Please try creating a new stream.";
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
      setIsStreaming(false);
    }
  };

  // Stop streaming
  const stopStreaming = () => {
    // Close WebRTC peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop media tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (setupVideoRef.current) {
      setupVideoRef.current.srcObject = null;
    }
    if (streamingVideoRef.current) {
      streamingVideoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    setStreamType(null);
    setStep('setup');
    toast.success("Stream stopped");
  };

  // Handle modal close
  const handleClose = () => {
    if (isStreaming) {
      if (confirm("You're currently live. Stop stream and close?")) {
        stopStreaming();
        onClose();
      }
    } else {
      onClose();
    }
  };

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Attach MediaStream to streaming video when step changes
  useEffect(() => {
    if (step === 'streaming' && mediaStreamRef.current && streamingVideoRef.current) {
      streamingVideoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [step]);

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="bg-[#1a0b2e] border-2 border-[#EB83EA]/30 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2f2942]">
          <h2 className="text-2xl font-bold text-white">
            {step === 'create' && "Create Livestream"}
            {step === 'setup' && `Stream: ${streamInfo?.title || "Setup"}`}
            {step === 'streaming' && (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                LIVE
              </span>
            )}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-full transition"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* STEP 1: Create Stream */}
          {step === 'create' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  Stream Title
                </label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={handleTitleChange}
                  placeholder="My Awesome Stream"
                  className={`w-full px-4 py-3 bg-[#2f2942] border-2 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#EB83EA] transition ${
                    titleError ? "border-red-500" : "border-[#EB83EA]/20"
                  }`}
                  disabled={isCreating}
                />
                <p className="text-xs text-gray-400 mt-2">
                  Letters, numbers, spaces, hyphens, and underscores only
                </p>
                {titleError && (
                  <p className="text-xs text-red-400 mt-1">{titleError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCreateStream}
                  disabled={isCreating || !!titleError || streamTitle.length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] text-white font-bold rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? "Creating..." : "Create Stream"}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Setup Stream */}
          {step === 'setup' && streamInfo && (
            <div className="space-y-6">
              {/* Video Preview */}
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                <video
                  ref={setupVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
                {!streamType && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-gray-400 text-center">
                      Select a video source to begin
                    </p>
                  </div>
                )}
              </div>

              {/* Browser Streaming Options */}
              {!streamType && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Browser Streaming</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={startCamera}
                      className="p-4 bg-[#2f2942] hover:bg-[#3f3952] border-2 border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl transition-all group"
                    >
                      <FiVideo className="w-8 h-8 text-[#EB83EA] mx-auto mb-2 group-hover:scale-110 transition" />
                      <h4 className="font-bold text-white mb-1">Camera</h4>
                      <p className="text-xs text-gray-400">Stream from webcam</p>
                    </button>

                    <button
                      onClick={startScreenShare}
                      className="p-4 bg-[#2f2942] hover:bg-[#3f3952] border-2 border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl transition-all group"
                    >
                      <FiMonitor className="w-8 h-8 text-[#EB83EA] mx-auto mb-2 group-hover:scale-110 transition" />
                      <h4 className="font-bold text-white mb-1">Screen</h4>
                      <p className="text-xs text-gray-400">Share your screen</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Controls when source selected */}
              {streamType && !isStreaming && (
                <div className="flex justify-center">
                  <button
                    onClick={startStreaming}
                    className="px-8 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-full font-bold transition-all shadow-lg"
                  >
                    Go Live
                  </button>
                </div>
              )}

              {/* RTMP Credentials (Collapsible) */}
              <div className="border-t border-[#2f2942] pt-6">
                <button
                  onClick={() => setShowRTMPDetails(!showRTMPDetails)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h3 className="text-lg font-bold text-white">OBS/Streamlabs Credentials</h3>
                  {showRTMPDetails ? (
                    <FiChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <FiChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {showRTMPDetails && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-2">
                        Server URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value="rtmp://rtmp.livepeer.com/live/"
                          readOnly
                          className="flex-1 px-4 py-2 bg-[#2f2942] border border-[#EB83EA]/20 rounded-lg text-white text-sm"
                        />
                        <button
                          onClick={() => copyToClipboard("rtmp://rtmp.livepeer.com/live/", "Server URL")}
                          className="p-2 bg-[#EB83EA]/20 hover:bg-[#EB83EA]/30 rounded-lg transition"
                        >
                          <FiCopy className="w-5 h-5 text-[#EB83EA]" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-2">
                        Stream Key
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={streamInfo.streamKey}
                          readOnly
                          className="flex-1 px-4 py-2 bg-[#2f2942] border border-[#EB83EA]/20 rounded-lg text-white text-sm"
                        />
                        <button
                          onClick={() => copyToClipboard(streamInfo.streamKey, "Stream key")}
                          className="p-2 bg-[#EB83EA]/20 hover:bg-[#EB83EA]/30 rounded-lg transition"
                        >
                          <FiCopy className="w-5 h-5 text-[#EB83EA]" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Streaming */}
          {step === 'streaming' && streamInfo && (
            <div className="space-y-6">
              {/* Video Preview with LIVE Badge */}
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                <video
                  ref={streamingVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  LIVE
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={toggleMute}
                  className={`px-6 py-3 rounded-full font-semibold transition-all flex items-center gap-2 ${
                    isMuted
                      ? "bg-red-500/20 text-red-400 border-2 border-red-500/40"
                      : "bg-[#2f2942] text-white border-2 border-[#EB83EA]/20 hover:border-[#EB83EA]/40"
                  }`}
                >
                  {isMuted ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
                  {isMuted ? "Unmute" : "Mute"}
                </button>

                <button
                  onClick={toggleVideo}
                  className={`px-6 py-3 rounded-full font-semibold transition-all flex items-center gap-2 ${
                    !videoEnabled
                      ? "bg-red-500/20 text-red-400 border-2 border-red-500/40"
                      : "bg-[#2f2942] text-white border-2 border-[#EB83EA]/20 hover:border-[#EB83EA]/40"
                  }`}
                >
                  {!videoEnabled ? <FiVideoOff className="w-5 h-5" /> : <FiVideo className="w-5 h-5" />}
                  {!videoEnabled ? "Show Video" : "Hide Video"}
                </button>

                <button
                  onClick={stopStreaming}
                  className="px-8 py-3 bg-red-500/20 border-2 border-red-500/40 text-red-400 hover:bg-red-500/30 rounded-full font-bold transition-all"
                >
                  Stop Stream
                </button>
              </div>

              {/* Viewer URL */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-2">
                  Viewers can watch your stream at:
                </p>
                <div className="flex gap-2">
                  <a
                    href={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${userHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-4 py-2 bg-[#2f2942] border border-blue-500/30 rounded-lg text-blue-400 text-sm hover:bg-[#3f3952] transition"
                  >
                    {`${typeof window !== "undefined" ? window.location.origin : ""}/u/${userHandle}`}
                  </a>
                  <button
                    onClick={() => copyToClipboard(`${typeof window !== "undefined" ? window.location.origin : ""}/u/${userHandle}`, "Profile URL")}
                    className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition"
                  >
                    <FiCopy className="w-5 h-5 text-blue-400" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
