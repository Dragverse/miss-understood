"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import { HeroSlider } from "./hero-slider";

export function HeroSection() {
  const [streamInfo, setStreamInfo] = useState<{
    isLive: boolean;
    playbackId?: string;
    playbackUrl?: string;
  }>({
    isLive: false,
  });
  const [checkingStream, setCheckingStream] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    // Check if stream is live using backend API
    const checkStream = async () => {
      try {
        const response = await fetch("/api/stream/status/official", {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        const data = await response.json();
        const wasLive = streamInfo.isLive;
        const nowLive = data.isLive || false;

        setStreamInfo({
          isLive: nowLive,
          playbackId: data.playbackId || process.env.NEXT_PUBLIC_OFFICIAL_PLAYBACK_ID || 'fb7fdq50qnczbi4u',
          playbackUrl: data.playbackUrl,
        });

        // Clear error and loaded state when stream status changes
        if (wasLive !== nowLive) {
          setPlayerError(null);
          setHasLoaded(false);
          console.log(`Stream status changed: ${wasLive ? 'LIVE' : 'OFFLINE'} → ${nowLive ? 'LIVE' : 'OFFLINE'}`);
        }

        // Log debug info
        console.log('Stream status:', {
          isLive: nowLive,
          playbackId: data.playbackId,
          method: data.method,
          reason: data.reason,
          fallback: data.fallback
        });
      } catch (error) {
        console.error("Failed to check stream status:", error);
        setStreamInfo({ isLive: false });
      } finally {
        setCheckingStream(false);
      }
    };

    checkStream();
    // Re-check every 10 seconds for more responsive status updates
    const interval = setInterval(checkStream, 10000);
    return () => clearInterval(interval);
  }, [streamInfo.isLive]); // Include streamInfo.isLive in deps to track changes

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left - Hero Slider */}
      <div className="lg:col-span-1 min-h-[400px]">
        <HeroSlider />
      </div>

      {/* Right - Dragverse Stream */}
      <div className="lg:col-span-2 relative rounded-[32px] overflow-hidden bg-[#1a0b2e] min-h-[400px] shadow-2xl">
        {/* Status Badge */}
        {!checkingStream && (
          <div className={`absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full ${
            streamInfo.isLive ? 'bg-[#4CAF50]' : 'bg-[#C62828]'
          }`}>
            <span className={`w-2 h-2 bg-white rounded-full ${streamInfo.isLive ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-bold uppercase text-white">{streamInfo.isLive ? 'Live' : 'Offline'}</span>
          </div>
        )}

        {checkingStream ? (
          // Loading state
          <div className="absolute inset-0 flex items-center justify-center bg-[#1a0b2e]">
            <div className="w-8 h-8 border-2 border-[#EB83EA] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : streamInfo.isLive ? (
          // Live stream player
          <div className="relative h-full">
            <Player.Root
              src={getSrc(streamInfo.playbackUrl || `https://livepeercdn.studio/hls/${streamInfo.playbackId}/index.m3u8`)}
              autoPlay
            >
              <Player.Container className="h-full">
                <Player.Video
                  className="w-full h-full object-cover"
                  onLoadedData={() => {
                    setHasLoaded(true);
                    setPlayerError(null);
                    console.log('✅ Stream loaded successfully');
                  }}
                  onError={(e) => {
                    // Only show error if player hasn't loaded successfully
                    if (!hasLoaded) {
                      console.error('❌ Video element error:', e);
                      setPlayerError('Unable to load stream. Please try again.');
                    } else {
                      console.warn('⚠️ Video error after successful load (ignoring):', e);
                    }
                  }}
                />
                <Player.Controls autoHide={3000} className="p-4">
                  <div className="flex items-center gap-2">
                    <Player.PlayPauseTrigger className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition" />
                    <Player.MuteTrigger className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition" />
                    <Player.FullscreenTrigger className="ml-auto w-10 h-10 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition" />
                  </div>
                </Player.Controls>
              </Player.Container>
            </Player.Root>

            {/* Error Display */}
            {playerError && !hasLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-red-500/20 border-2 border-red-500/40 rounded-2xl p-6 max-w-md mx-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-red-300 font-semibold mb-2">Stream Error</p>
                  <p className="text-red-200 text-sm mb-4">{playerError}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setPlayerError(null);
                        setHasLoaded(false);
                      }}
                      className="flex-1 px-4 py-2 bg-red-500/30 hover:bg-red-500/40 text-red-200 rounded-lg font-medium text-sm transition"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={() => {
                        setStreamInfo({ isLive: false });
                        setPlayerError(null);
                      }}
                      className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg font-medium text-sm transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Offline placeholder with text overlay
          <div className="absolute inset-0">
            <Image
              src="/currently-offline.jpg"
              alt="Stream Currently Offline"
              fill
              className="object-cover"
            />
            {/* Yellow "CURRENTLY OFFLINE" text overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="text-center px-6">
                <h2 className="text-5xl md:text-7xl font-bold uppercase tracking-widest mb-2" style={{
                  background: 'linear-gradient(to right, #FCD34D, #FBBF24)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 0 40px rgba(252, 211, 77, 0.5)'
                }}>
                  Currently
                </h2>
                <h2 className="text-6xl md:text-8xl font-bold uppercase tracking-widest" style={{
                  background: 'linear-gradient(to right, #FCD34D, #FBBF24)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 0 40px rgba(252, 211, 77, 0.5)'
                }}>
                  Offline
                </h2>
              </div>
            </div>
          </div>
        )}
        </div>
    </section>
  );
}
