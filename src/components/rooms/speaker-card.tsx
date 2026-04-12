"use client";

import { useEffect, useRef } from "react";
import { useRemotePeer, useRemoteVideo, useRemoteAudio } from "@huddle01/react/hooks";
import Image from "next/image";
import { FiMic, FiMicOff } from "react-icons/fi";

interface PeerMetadata {
  displayName?: string;
  avatarUrl?: string;
}

// Remote speaker — subscribes to both audio and video tracks
export function SpeakerCard({ peerId, isHost }: { peerId: string; isHost?: boolean }) {
  const { metadata } = useRemotePeer<PeerMetadata>({ peerId });
  const { stream: videoStream, isVideoOn } = useRemoteVideo({ peerId });
  const { stream: audioStream, isAudioOn } = useRemoteAudio({ peerId });

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const displayName = metadata?.displayName || "Artist";
  const avatarUrl = metadata?.avatarUrl || "/defaultpfp.png";

  // Attach video stream
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  // Attach audio stream — this is what actually plays the speaker's voice
  useEffect(() => {
    if (audioRef.current && audioStream) {
      audioRef.current.srcObject = audioStream;
      audioRef.current.play().catch(() => {});
    }
  }, [audioStream]);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Hidden audio element — plays the remote peer's mic */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      <div className="relative">
        {isVideoOn ? (
          /* Video on — show a larger rounded-xl card */
          <div className="relative w-36 h-24 rounded-xl overflow-hidden border-2 border-[#EB83EA]/60 shadow-lg shadow-[#EB83EA]/20">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {isHost && (
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-[#EB83EA] rounded-full text-[9px] font-black text-white uppercase">
                HOST
              </span>
            )}
            {/* Mic indicator */}
            <div className={`absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center border border-white/20 ${isAudioOn ? "bg-[#EB83EA]" : "bg-black/60"}`}>
              {isAudioOn ? <FiMic className="w-2.5 h-2.5 text-white" /> : <FiMicOff className="w-2.5 h-2.5 text-gray-400" />}
            </div>
          </div>
        ) : (
          /* Audio only — circular avatar */
          <div className={`rounded-full p-0.5 ${isAudioOn ? "bg-gradient-to-br from-[#EB83EA] to-[#7c3aed]" : "bg-[#2f2942]"} w-16 h-16`}>
            <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#0f071a] relative">
              <Image
                src={avatarUrl}
                alt={displayName}
                width={60}
                height={60}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = "/defaultpfp.png"; }}
              />
            </div>
            {isHost && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-[#EB83EA] rounded-full text-[9px] font-black text-white uppercase whitespace-nowrap">
                HOST
              </span>
            )}
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0f071a] ${isAudioOn ? "bg-[#EB83EA]" : "bg-gray-700"}`}>
              {isAudioOn ? <FiMic className="w-2.5 h-2.5 text-white" /> : <FiMicOff className="w-2.5 h-2.5 text-gray-400" />}
            </div>
          </div>
        )}
      </div>

      <p className="text-white text-xs font-semibold text-center line-clamp-1 w-28">{displayName}</p>
    </div>
  );
}

// Local peer (self) — isMicOn and isVideoOn come from useLocalAudio / useLocalVideo
export function LocalSpeakerCard({
  displayName,
  avatarUrl,
  isMicOn,
  isVideoOn,
  localVideoStream,
  isHost,
}: {
  displayName: string;
  avatarUrl: string;
  isMicOn: boolean;
  isVideoOn: boolean;
  localVideoStream: MediaStream | null;
  isHost: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && localVideoStream) {
      videoRef.current.srcObject = localVideoStream;
    }
  }, [localVideoStream]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {isVideoOn && localVideoStream ? (
          <div className="relative w-36 h-24 rounded-xl overflow-hidden border-2 border-[#EB83EA]/60 shadow-lg shadow-[#EB83EA]/20">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {isHost && (
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-[#EB83EA] rounded-full text-[9px] font-black text-white uppercase">
                HOST
              </span>
            )}
            <div className={`absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center border border-white/20 ${isMicOn ? "bg-[#EB83EA]" : "bg-black/60"}`}>
              {isMicOn ? <FiMic className="w-2.5 h-2.5 text-white" /> : <FiMicOff className="w-2.5 h-2.5 text-gray-400" />}
            </div>
          </div>
        ) : (
          <div className={`rounded-full p-0.5 ${isMicOn ? "bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] animate-pulse" : "bg-[#2f2942]"} w-16 h-16`}>
            <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#0f071a]">
              <Image
                src={avatarUrl}
                alt={displayName}
                width={60}
                height={60}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = "/defaultpfp.png"; }}
              />
            </div>
            {isHost && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-[#EB83EA] rounded-full text-[9px] font-black text-white uppercase whitespace-nowrap">
                HOST
              </span>
            )}
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0f071a] ${isMicOn ? "bg-[#EB83EA]" : "bg-gray-700"}`}>
              {isMicOn ? <FiMic className="w-2.5 h-2.5 text-white" /> : <FiMicOff className="w-2.5 h-2.5 text-gray-400" />}
            </div>
          </div>
        )}
      </div>
      <p className="text-white text-xs font-semibold text-center line-clamp-1 w-28">{displayName} (You)</p>
    </div>
  );
}
