"use client";

import { useEffect, useRef } from "react";
import { useRemotePeer, useRemoteVideo } from "@huddle01/react/hooks";
import Image from "next/image";
import { FiMic, FiMicOff, FiVideo } from "react-icons/fi";

interface PeerMetadata {
  displayName?: string;
  avatarUrl?: string;
}

// Remote speaker — video shown if peer has video on
export function SpeakerCard({ peerId, isHost }: { peerId: string; isHost?: boolean }) {
  const { metadata } = useRemotePeer<PeerMetadata>({ peerId });
  const { stream, isVideoOn } = useRemoteVideo({ peerId });
  const videoRef = useRef<HTMLVideoElement>(null);

  const displayName = metadata?.displayName || "Artist";
  const avatarUrl = metadata?.avatarUrl || "/defaultpfp.png";

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div
          className={`rounded-full p-0.5 bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] ${
            isVideoOn ? "w-24 h-24" : "w-16 h-16"
          }`}
        >
          <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#0f071a] relative">
            {isVideoOn ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={60}
                height={60}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = "/defaultpfp.png"; }}
              />
            )}
          </div>
        </div>
        {isHost && (
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-[#EB83EA] rounded-full text-[9px] font-black text-white uppercase">
            HOST
          </span>
        )}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0f071a] bg-[#EB83EA]">
          {isVideoOn ? (
            <FiVideo className="w-2.5 h-2.5 text-white" />
          ) : (
            <FiMic className="w-2.5 h-2.5 text-white" />
          )}
        </div>
      </div>
      <p className="text-white text-xs font-semibold text-center line-clamp-1 w-24">{displayName}</p>
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
        <div
          className={`rounded-full p-0.5 ${
            isMicOn || isVideoOn
              ? "bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] animate-pulse"
              : "bg-[#2f2942]"
          } ${isVideoOn ? "w-24 h-24" : "w-16 h-16"}`}
        >
          <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#0f071a]">
            {isVideoOn && localVideoStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={60}
                height={60}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = "/defaultpfp.png"; }}
              />
            )}
          </div>
        </div>
        {isHost && (
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-[#EB83EA] rounded-full text-[9px] font-black text-white uppercase">
            HOST
          </span>
        )}
        <div
          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0f071a] ${
            isMicOn ? "bg-[#EB83EA]" : "bg-gray-700"
          }`}
        >
          {isMicOn ? (
            <FiMic className="w-2.5 h-2.5 text-white" />
          ) : (
            <FiMicOff className="w-2.5 h-2.5 text-gray-400" />
          )}
        </div>
      </div>
      <p className="text-white text-xs font-semibold text-center line-clamp-1 w-24">{displayName} (You)</p>
    </div>
  );
}
