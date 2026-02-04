"use client";

import { useState, useRef, useEffect } from "react";
import { FiVideo, FiMonitor, FiMic, FiMicOff, FiVideoOff, FiX, FiCopy, FiChevronDown, FiChevronUp } from "react-icons/fi";
import toast from "react-hot-toast";
import { usePrivy } from "@privy-io/react-auth";

interface StreamModalProps {
  onClose: () => void;
}

type StreamStep = 'create' | 'method' | 'setup' | 'streaming';
type StreamingMethod = 'browser' | 'obs' | null;

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
  const [streamingMethod, setStreamingMethod] = useState<StreamingMethod>(null);

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

  // Connection monitoring state and refs
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const keepaliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const streamStartTimeRef = useRef<number>(0);

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

            setStep('method');
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

      setStep('method');
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

      // Status 0 is expected with redirect: "manual" (opaque response for CORS redirects)
      // Status 307 is an explicit redirect
      // Any 2xx status is success
      const isValidResponse = redirectResponse.status === 0 ||
                             redirectResponse.status === 307 ||
                             redirectResponse.ok;

      if (!isValidResponse && redirectResponse.status >= 400) {
        console.error("❌ Failed to get WebRTC redirect:", redirectResponse.status);
        throw new Error(`Failed to connect to Livepeer (${redirectResponse.status}). Please check your stream key.`);
      }

      const ingestUrl = redirectResponse.headers.get("location") || redirectUrl;
      console.log("✅ WebRTC ingest URL:", ingestUrl);

      // Step 2: Extract hostname from ingest URL for Livepeer's STUN/TURN servers
      const ingestHostname = new URL(ingestUrl).hostname;
      console.log("📡 Using Livepeer's ICE servers:", ingestHostname);

      // Step 3: Create RTCPeerConnection with Livepeer's ICE servers + Google fallback
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          {
            urls: `stun:${ingestHostname}`
          },
          {
            urls: `turn:${ingestHostname}`,
            username: "livepeer",
            credential: "livepeer"
          },
          // Add Google STUN as fallback
          {
            urls: "stun:stun.l.google.com:19302"
          },
          {
            urls: "stun:stun1.l.google.com:19302"
          }
        ],
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
        iceCandidatePoolSize: 10
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

      peerConnection.addEventListener("icecandidateerror", (event) => {
        console.error("❌ ICE candidate error:", {
          errorCode: event.errorCode,
          errorText: event.errorText,
          url: event.url,
          address: event.address,
          port: event.port
        });
      });

      peerConnection.addEventListener("iceconnectionstatechange", () => {
        console.log("🔌 ICE connection state:", peerConnection.iceConnectionState);
      });

      peerConnection.addEventListener("icegatheringstatechange", () => {
        console.log("🔍 ICE gathering state:", peerConnection.iceGatheringState);
      });

      peerConnection.addEventListener("connectionstatechange", () => {
        console.log("📡 Connection state:", peerConnection.connectionState);
        console.log("🔌 ICE connection state:", peerConnection.iceConnectionState);

        if (peerConnection.connectionState === "connected") {
          toast.success("Stream connected!");
        } else if (peerConnection.connectionState === "failed") {
          console.error("❌ Connection failed - ICE state:", peerConnection.iceConnectionState);
          // Don't immediately stop - the sendKeepalive function will detect this
          // and attempt reconnection via attemptReconnection()
        } else if (peerConnection.connectionState === "disconnected") {
          console.warn("⚠️ Connection disconnected - ICE state:", peerConnection.iceConnectionState);
          // Don't immediately stop - give reconnection logic a chance to work
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
      let isConnectionResolved = false;
      const connectionTimeout = setTimeout(() => {
        if (!isConnectionResolved && peerConnection.connectionState !== "connected") {
          isConnectionResolved = true;
          console.error("❌ Connection timeout after 30s - state:", peerConnection.connectionState, "ICE:", peerConnection.iceConnectionState);
          toast.error("Connection timeout. Please check your network or try OBS/Streamlabs.");
          stopStreaming();
        }
      }, 30000); // 30 second timeout

      // Clear timeout when any terminal state is reached
      const clearTimeoutOnTerminalState = () => {
        if (!isConnectionResolved) {
          isConnectionResolved = true;
          clearTimeout(connectionTimeout);
        }
      };

      peerConnection.addEventListener("connectionstatechange", () => {
        if (peerConnection.connectionState === "connected") {
          clearTimeoutOnTerminalState();
        } else if (peerConnection.connectionState === "failed" || peerConnection.connectionState === "closed") {
          clearTimeoutOnTerminalState();
        }
      });

      setStep('streaming');
      toast.success("🎥 Live on Dragverse!");

      // Update database status to active
      await updateStreamStatus(true);
      console.log('✅ Database updated: is_active = true');

      // Start connection monitoring
      reconnectAttemptsRef.current = 0;
      streamStartTimeRef.current = Date.now(); // Track when stream started
      monitorMediaTracks();

      // Monitor connection quality every 5 seconds
      statsIntervalRef.current = setInterval(monitorConnectionStats, 5000);

      // Send keepalive every 15 seconds (prevents NAT timeout)
      keepaliveIntervalRef.current = setInterval(sendKeepalive, 15000);

      console.log('✅ Connection monitoring active');

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

  // Monitor connection statistics
  const monitorConnectionStats = async () => {
    if (!peerConnectionRef.current) return;

    try {
      const stats = await peerConnectionRef.current.getStats();
      let bytesReceived = 0;
      let bytesSent = 0;
      let packetsLost = 0;
      let totalPackets = 0;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp') {
          bytesReceived += report.bytesReceived || 0;
          packetsLost += report.packetsLost || 0;
          totalPackets += report.packetsReceived || 0;
        }
        if (report.type === 'outbound-rtp') {
          bytesSent += report.bytesSent || 0;
        }
      });

      // Calculate connection quality
      const packetLossRate = totalPackets > 0 ? packetsLost / totalPackets : 0;

      // Grace period: Don't check bytesSent for first 10 seconds after stream starts
      const streamDuration = Date.now() - streamStartTimeRef.current;
      const hasGracePeriodPassed = streamDuration > 10000;

      if (packetLossRate > 0.1 || (hasGracePeriodPassed && bytesSent === 0)) {
        setConnectionQuality('poor');
        console.warn('Poor connection quality detected', { packetLossRate, bytesSent, streamDuration });
      } else if (packetLossRate > 0.05) {
        setConnectionQuality('fair');
      } else {
        setConnectionQuality('good');
      }

      // Log stats for debugging
      console.log('WebRTC Stats:', {
        bytesSent,
        bytesReceived,
        packetsLost,
        totalPackets,
        packetLossRate: (packetLossRate * 100).toFixed(2) + '%'
      });

    } catch (error) {
      console.error('Failed to get connection stats:', error);
    }
  };

  // Send keepalive and check connection health
  const sendKeepalive = async () => {
    if (!peerConnectionRef.current) return;

    const state = peerConnectionRef.current.connectionState;

    if (state === 'connected') {
      // Connection is healthy, keepalive via stats polling
      await monitorConnectionStats();
    } else if (state === 'connecting' || state === 'new') {
      console.log('Connection still establishing...');
    } else if (state === 'disconnected') {
      console.warn('Connection disconnected, attempting reconnection...');
      await attemptReconnection();
    } else if (state === 'failed') {
      console.error('Connection failed permanently');
      toast.error('Stream connection failed. Please try again.');
      stopStreaming();
    }
  };

  // Attempt to reconnect the stream
  const attemptReconnection = async () => {
    if (!peerConnectionRef.current || !mediaStreamRef.current || !streamInfo) return;

    reconnectAttemptsRef.current++;

    if (reconnectAttemptsRef.current > maxReconnectAttempts) {
      toast.error('Unable to maintain connection. Stream stopped.');
      stopStreaming();
      return;
    }

    toast('Reconnecting...', { icon: '🔄' });

    try {
      // Attempt ICE restart
      const offer = await peerConnectionRef.current.createOffer({ iceRestart: true });
      await peerConnectionRef.current.setLocalDescription(offer);

      // Re-negotiate with Livepeer
      const ingestUrl = `https://livepeer.studio/webrtc/${streamInfo.streamKey}`;
      const whipResponse = await fetch(ingestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: peerConnectionRef.current.localDescription?.sdp
      });

      if (whipResponse.ok) {
        const answerSdp = await whipResponse.text();
        await peerConnectionRef.current.setRemoteDescription({
          type: "answer",
          sdp: answerSdp
        });

        reconnectAttemptsRef.current = 0; // Reset on success
        toast.success('Reconnected successfully');
      } else {
        throw new Error('Reconnection failed');
      }
    } catch (error) {
      console.error('Reconnection attempt failed:', error);
      // Will retry on next keepalive interval
    }
  };

  // Monitor media track state
  const monitorMediaTracks = () => {
    if (!mediaStreamRef.current) return;

    mediaStreamRef.current.getTracks().forEach(track => {
      track.addEventListener('ended', () => {
        console.warn(`Track ended: ${track.kind}`);

        if (track.kind === 'video' && streamType === 'screen') {
          // User stopped screen share via browser UI
          toast('Screen sharing stopped');
          stopStreaming();
        } else {
          toast.error(`${track.kind === 'video' ? 'Camera' : 'Microphone'} disconnected`);
          // Could attempt to re-acquire device here
        }
      });

      track.addEventListener('mute', () => {
        console.warn(`Track muted: ${track.kind}`);
        toast(`${track.kind === 'video' ? 'Camera' : 'Microphone'} muted by system`,
              { icon: '⚠️' });
      });
    });
  };

  // Update stream status in database
  const updateStreamStatus = async (isActive: boolean) => {
    if (!streamInfo?.id) {
      console.error('Cannot update stream status: no stream ID');
      return;
    }

    try {
      const authToken = await getAccessToken();
      const url = `/api/stream/status/${streamInfo.id}`;

      console.log(`📡 Updating stream status:`, {
        url,
        streamId: streamInfo.id,
        isActive,
        hasAuth: !!authToken
      });

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ is_active: isActive })
      });

      console.log(`📡 Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error Response:`, errorText);
        throw new Error(`Failed to update stream status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Stream status updated in database:', data);

    } catch (error) {
      console.error('❌ Failed to update stream status:', error);
      // Don't block streaming on this error, but log it
      // Only show toast if it's not a 404 (which might be a deployment issue)
      if (error instanceof Error && !error.message.includes('404')) {
        toast.error('Warning: Stream may not appear on profile immediately');
      } else {
        console.warn('⚠️ Stream status API returned 404. Stream will still work, but may not appear on profile until deployment completes.');
      }
    }
  };

  // Stop streaming
  const stopStreaming = async () => {
    // Clear monitoring intervals
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    if (keepaliveIntervalRef.current) {
      clearInterval(keepaliveIntervalRef.current);
      keepaliveIntervalRef.current = null;
    }

    // Update database status to inactive
    await updateStreamStatus(false);
    console.log('✅ Database updated: is_active = false');

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
    setStreamingMethod(null);
    setConnectionQuality('good'); // Reset connection quality
    streamStartTimeRef.current = 0; // Reset stream start time
    setStep('method');
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
      // Cleanup intervals
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      if (keepaliveIntervalRef.current) clearInterval(keepaliveIntervalRef.current);

      // Cleanup WebRTC
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
            {step === 'method' && `Stream: ${streamInfo?.title || "Choose Method"}`}
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

          {/* STEP 1.5: Choose Streaming Method */}
          {step === 'method' && streamInfo && (
            <div className="space-y-6">
              <p className="text-gray-300 text-center mb-6">
                Choose how you want to stream. Browser streaming is quick and easy, while OBS/Streamlabs offers professional features.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Browser Streaming Option */}
                <button
                  onClick={() => {
                    setStreamingMethod('browser');
                    setStep('setup');
                  }}
                  className="p-8 bg-[#2f2942] hover:bg-[#3f3952] border-2 border-[#EB83EA]/20 hover:border-[#EB83EA]/60 rounded-2xl transition-all group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#EB83EA]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative">
                    <FiVideo className="w-12 h-12 text-[#EB83EA] mx-auto mb-4 group-hover:scale-110 transition" />
                    <h3 className="font-bold text-white text-lg mb-2">Browser Streaming</h3>
                    <p className="text-sm text-gray-400 mb-3">Stream from your camera or screen</p>
                    <ul className="text-xs text-gray-500 space-y-1 text-left">
                      <li>• Quick & easy setup</li>
                      <li>• No software needed</li>
                      <li>• Camera or screen share</li>
                      <li>• Lower latency</li>
                    </ul>
                  </div>
                </button>

                {/* OBS/Streamlabs Option */}
                <button
                  onClick={() => {
                    setStreamingMethod('obs');
                    setStep('setup');
                  }}
                  className="p-8 bg-[#2f2942] hover:bg-[#3f3952] border-2 border-[#EB83EA]/20 hover:border-[#EB83EA]/60 rounded-2xl transition-all group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative">
                    <FiMonitor className="w-12 h-12 text-[#7c3aed] mx-auto mb-4 group-hover:scale-110 transition" />
                    <h3 className="font-bold text-white text-lg mb-2">OBS / Streamlabs</h3>
                    <p className="text-sm text-gray-400 mb-3">Professional streaming software</p>
                    <ul className="text-xs text-gray-500 space-y-1 text-left">
                      <li>• Multi-camera setup</li>
                      <li>• Scenes & overlays</li>
                      <li>• Advanced controls</li>
                      <li>• Professional quality</li>
                    </ul>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setStep('create')}
                className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition"
              >
                Back
              </button>
            </div>
          )}

          {/* STEP 2: Setup Stream */}
          {step === 'setup' && streamInfo && streamingMethod === 'browser' && (
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
                  <h3 className="text-lg font-bold text-white mb-3">Choose Video Source</h3>
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
                <div className="flex flex-col gap-3">
                  <button
                    onClick={startStreaming}
                    className="px-8 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-full font-bold transition-all shadow-lg"
                  >
                    Go Live
                  </button>
                  <button
                    onClick={() => setStep('method')}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition text-sm"
                  >
                    Change Streaming Method
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2B: Setup Stream - OBS/Streamlabs */}
          {step === 'setup' && streamInfo && streamingMethod === 'obs' && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <h3 className="text-blue-400 font-semibold mb-2">Professional Streaming Setup</h3>
                <p className="text-sm text-gray-400">
                  Copy these credentials into OBS Studio or Streamlabs. Once you start streaming from your software, your stream will automatically appear on your profile.
                </p>
              </div>

              {/* RTMP Credentials */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">
                    Server URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value="rtmp://rtmp.livepeer.com/live/"
                      readOnly
                      className="flex-1 px-4 py-3 bg-[#2f2942] border border-[#EB83EA]/20 rounded-lg text-white"
                    />
                    <button
                      onClick={() => copyToClipboard("rtmp://rtmp.livepeer.com/live/", "Server URL")}
                      className="p-3 bg-[#EB83EA]/20 hover:bg-[#EB83EA]/30 rounded-lg transition"
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
                      className="flex-1 px-4 py-3 bg-[#2f2942] border border-[#EB83EA]/20 rounded-lg text-white font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(streamInfo.streamKey, "Stream key")}
                      className="p-3 bg-[#EB83EA]/20 hover:bg-[#EB83EA]/30 rounded-lg transition"
                    >
                      <FiCopy className="w-5 h-5 text-[#EB83EA]" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Keep your stream key private!</p>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-4 bg-[#2f2942] rounded-xl">
                <h4 className="font-bold text-white mb-3">Setup Instructions:</h4>
                <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                  <li>Open OBS Studio or Streamlabs</li>
                  <li>Go to Settings → Stream</li>
                  <li>Select "Custom" as the service</li>
                  <li>Paste the Server URL and Stream Key above</li>
                  <li>Click "Start Streaming" in your software</li>
                </ol>
              </div>

              {/* Viewer URL */}
              {userHandle && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <h4 className="text-green-400 font-semibold mb-2">Your stream will appear at:</h4>
                  <a
                    href={`/u/${userHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#EB83EA] hover:underline break-all"
                  >
                    {`${typeof window !== "undefined" ? window.location.origin : ""}/u/${userHandle}`}
                  </a>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setStep('method')}
                  className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition"
                >
                  Change Streaming Method
                </button>
                <button
                  onClick={onClose}
                  className="w-full px-6 py-3 border-2 border-white/10 hover:border-white/20 text-white font-semibold rounded-full transition"
                >
                  Close (Keep Stream Active)
                </button>
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
                {/* Connection Quality Indicator */}
                <div className={`absolute top-4 right-4 px-3 py-1 text-white text-xs font-semibold rounded-full ${
                  connectionQuality === 'good' ? 'bg-green-500/80' :
                  connectionQuality === 'fair' ? 'bg-yellow-500/80' :
                  'bg-red-500/80'
                }`}>
                  {connectionQuality === 'good' ? '🟢 Good' :
                   connectionQuality === 'fair' ? '🟡 Fair' :
                   '🔴 Poor'}
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
