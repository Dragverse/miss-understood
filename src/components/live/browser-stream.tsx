"use client";

import { useState, useRef, useEffect } from "react";
import { FiVideo, FiMonitor, FiMic, FiMicOff, FiVideoOff, FiX, FiAlertCircle } from "react-icons/fi";
import toast from "react-hot-toast";

interface BrowserStreamProps {
  streamKey: string;
  rtmpIngestUrl: string;
  onClose: () => void;
}

export function BrowserStream({ streamKey, rtmpIngestUrl, onClose }: BrowserStreamProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [streamType, setStreamType] = useState<"camera" | "screen" | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStreamType("camera");
      toast.success("Camera access granted");
    } catch (error) {
      console.error("Camera access error:", error);
      toast.error("Could not access camera. Please check permissions.");
    }
  };

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
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

  const toggleMute = () => {
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (mediaStreamRef.current) {
      const videoTracks = mediaStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoEnabled(!videoEnabled);
    }
  };

  const startStreaming = async () => {
    if (!mediaStreamRef.current) {
      toast.error("Please select a video source first");
      return;
    }

    try {
      setIsStreaming(true);
      toast.success("Starting stream...");

      // Note: Browser-to-RTMP streaming requires a WebRTC-to-RTMP bridge
      // For production, you'll need to:
      // 1. Use Livepeer's WebRTC ingestion (if available)
      // 2. Or set up a media server (like Janus or Mediasoup) to bridge WebRTC to RTMP
      // 3. Or use a service like Mux or Daily.co for WebRTC streaming

      // For now, we'll show a placeholder implementation
      console.log("Stream would start with:", {
        streamKey,
        rtmpIngestUrl,
        tracks: mediaStreamRef.current.getTracks().map(t => t.kind)
      });

      toast("Browser streaming is in beta. For best results, use OBS Studio.", {
        duration: 5000,
        icon: "ℹ️"
      });

    } catch (error) {
      console.error("Streaming error:", error);
      toast.error("Failed to start stream");
      setIsStreaming(false);
    }
  };

  const stopStreaming = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    setStreamType(null);
    toast.success("Stream stopped");
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a0b2e] border-2 border-[#EB83EA]/30 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2f2942]">
          <h2 className="text-2xl font-bold text-white">Browser Streaming</h2>
          <button
            onClick={() => {
              stopStreaming();
              onClose();
            }}
            className="p-2 hover:bg-white/10 rounded-full transition"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Video Preview */}
        <div className="p-6">
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden mb-6">
            <video
              ref={videoRef}
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
            {streamType && !isStreaming && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-yellow-500/80 text-white text-sm font-bold rounded-full">
                NOT LIVE
              </div>
            )}
            {isStreaming && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                LIVE
              </div>
            )}
          </div>

          {/* Beta Warning */}
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
            <FiAlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-yellow-500 font-semibold mb-1">Beta Feature</p>
              <p className="text-gray-400">
                Browser streaming is experimental. For best quality and reliability, we recommend using <strong>OBS Studio</strong> or <strong>Streamlabs</strong> with the RTMP credentials above.
              </p>
            </div>
          </div>

          {/* Source Selection */}
          {!streamType && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={startCamera}
                className="p-6 bg-[#2f2942] hover:bg-[#3f3952] border-2 border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl transition-all group"
              >
                <FiVideo className="w-8 h-8 text-[#EB83EA] mx-auto mb-3 group-hover:scale-110 transition" />
                <h3 className="font-bold text-white mb-1">Camera</h3>
                <p className="text-sm text-gray-400">Stream from webcam</p>
              </button>

              <button
                onClick={startScreenShare}
                className="p-6 bg-[#2f2942] hover:bg-[#3f3952] border-2 border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl transition-all group"
              >
                <FiMonitor className="w-8 h-8 text-[#EB83EA] mx-auto mb-3 group-hover:scale-110 transition" />
                <h3 className="font-bold text-white mb-1">Screen</h3>
                <p className="text-sm text-gray-400">Share your screen</p>
              </button>
            </div>
          )}

          {/* Controls */}
          {streamType && (
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

              {!isStreaming ? (
                <button
                  onClick={startStreaming}
                  className="px-8 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-full font-bold transition-all shadow-lg"
                >
                  Go Live
                </button>
              ) : (
                <button
                  onClick={stopStreaming}
                  className="px-8 py-3 bg-red-500/20 border-2 border-red-500/40 text-red-400 hover:bg-red-500/30 rounded-full font-bold transition-all"
                >
                  Stop Stream
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
