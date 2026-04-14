"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthUser } from "@/lib/privy/hooks";
import { FiSend, FiMessageCircle } from "react-icons/fi";
import { SiBluesky } from "react-icons/si";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";

interface Participant {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface ConvoLastMessage {
  text?: string;
  sentAt?: string;
}

interface Convo {
  id: string;
  lastMessage?: ConvoLastMessage;
  unreadCount?: number;
  members: Participant[];
}

interface Message {
  id: string;
  text?: string;
  sentAt?: string;
  sender: { did: string };
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MessagesPage() {
  const { isAuthenticated, blueskyConnected, blueskyProfile } = useAuthUser();
  const { getAccessToken } = usePrivy();

  const [convos, setConvos] = useState<Convo[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Convo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConvos, setIsLoadingConvos] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations list
  useEffect(() => {
    if (!isAuthenticated || !blueskyConnected) return;

    async function loadConvos() {
      setIsLoadingConvos(true);
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/bluesky/dms/convos", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setConvos(data.convos || []);
        }
      } catch (err) {
        console.error("[Messages] Failed to load convos:", err);
      } finally {
        setIsLoadingConvos(false);
      }
    }

    loadConvos();
  }, [isAuthenticated, blueskyConnected, getAccessToken]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConvo) return;

    async function loadMessages() {
      setIsLoadingMessages(true);
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `/api/bluesky/dms/messages?convoId=${selectedConvo!.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setMessages((data.messages || []).reverse());
        }
      } catch (err) {
        console.error("[Messages] Failed to load messages:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    }

    loadMessages();
  }, [selectedConvo, getAccessToken]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedConvo || isSending) return;
    const text = inputText.trim();
    setInputText("");
    setIsSending(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/bluesky/dms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ convoId: selectedConvo.id, text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
        }
      }
    } catch (err) {
      console.error("[Messages] Failed to send:", err);
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  };

  const getOtherMember = (convo: Convo): Participant | undefined =>
    convo.members.find((m) => m.did !== blueskyProfile?.did);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Sign in to view messages.
      </div>
    );
  }

  if (!blueskyConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <SiBluesky className="w-12 h-12 text-blue-400" />
        <h2 className="text-2xl font-bold text-white">Connect Bluesky to use DMs</h2>
        <p className="text-gray-400 max-w-sm">
          Bluesky direct messages let you chat privately with other creators. Connect your account in Settings.
        </p>
        <a
          href="/settings"
          className="px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-full transition"
        >
          Go to Settings
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0620]">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
          <FiMessageCircle className="w-7 h-7 text-[#EB83EA]" />
          Messages
        </h1>

        <div className="flex gap-0 rounded-3xl overflow-hidden border-2 border-[#EB83EA]/20 min-h-[70vh]">
          {/* Conversation list */}
          <div className="w-full md:w-80 flex-shrink-0 bg-[#1a0b2e] border-r border-[#2f2942] flex flex-col">
            <div className="p-4 border-b border-[#2f2942]">
              <p className="text-sm text-gray-400 font-semibold uppercase tracking-wider">Conversations</p>
            </div>

            {isLoadingConvos ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-white/10 rounded w-3/4" />
                      <div className="h-2 bg-white/10 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : convos.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6 text-center">
                <p className="text-gray-500 text-sm">No conversations yet.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {convos.map((convo) => {
                  const other = getOtherMember(convo);
                  const isSelected = selectedConvo?.id === convo.id;
                  return (
                    <button
                      key={convo.id}
                      onClick={() => { setSelectedConvo(convo); setMessages([]); }}
                      className={`w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition border-b border-[#2f2942]/50 ${
                        isSelected ? "bg-white/10" : ""
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        {other?.avatar ? (
                          <Image
                            src={other.avatar}
                            alt={other.displayName || other.handle}
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#EB83EA]/20 flex items-center justify-center text-[#EB83EA] font-bold">
                            {(other?.displayName || other?.handle || "?")[0].toUpperCase()}
                          </div>
                        )}
                        {(convo.unreadCount ?? 0) > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#EB83EA] rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                            {convo.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {other?.displayName || other?.handle || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {convo.lastMessage?.text || "No messages yet"}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-500 flex-shrink-0">
                        {timeAgo(convo.lastMessage?.sentAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Message thread */}
          <div className="hidden md:flex flex-1 flex-col bg-[#12082a]">
            {!selectedConvo ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3">
                <FiMessageCircle className="w-12 h-12 opacity-30" />
                <p>Select a conversation to start chatting</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="p-4 border-b border-[#2f2942] flex items-center gap-3">
                  {(() => {
                    const other = getOtherMember(selectedConvo);
                    return (
                      <>
                        {other?.avatar ? (
                          <Image
                            src={other.avatar}
                            alt={other.displayName || other.handle}
                            width={36}
                            height={36}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#EB83EA]/20 flex items-center justify-center text-[#EB83EA] font-bold">
                            {(other?.displayName || other?.handle || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-white text-sm">
                            {other?.displayName || other?.handle}
                          </p>
                          {other?.handle && (
                            <p className="text-xs text-gray-400">@{other.handle}</p>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Loading…
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No messages yet. Say hi!
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.sender?.did === blueskyProfile?.did;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                              isMine
                                ? "bg-[#EB83EA] text-black rounded-br-sm"
                                : "bg-[#2f2942] text-white rounded-bl-sm"
                            }`}
                          >
                            <p>{msg.text}</p>
                            <p className={`text-[10px] mt-1 ${isMine ? "text-black/60" : "text-gray-500"}`}>
                              {timeAgo(msg.sentAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-[#2f2942] flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a message…"
                    className="flex-1 px-4 py-2.5 bg-[#2f2942] border border-[#EB83EA]/20 rounded-full text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#EB83EA] transition"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputText.trim() || isSending}
                    className="p-2.5 bg-[#EB83EA] hover:bg-[#E748E6] disabled:opacity-40 rounded-full transition"
                    aria-label="Send message"
                  >
                    <FiSend className="w-4 h-4 text-black" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
