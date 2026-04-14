"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthUser } from "@/lib/privy/hooks";
import { FiSend, FiMessageCircle, FiPlus, FiSearch, FiX, FiArrowLeft } from "react-icons/fi";
import { SiBluesky } from "react-icons/si";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import toast from "react-hot-toast";

interface MutualFollow {
  did: string;
  handle: string;
  displayName: string;
  avatar: string | null;
}

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

  // New message flow
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [mutuals, setMutuals] = useState<MutualFollow[]>([]);
  const [mutualsSearch, setMutualsSearch] = useState("");
  const [isLoadingMutuals, setIsLoadingMutuals] = useState(false);
  const [isStartingConvo, setIsStartingConvo] = useState(false);

  // Mobile: show thread panel when a convo is selected
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Load conversations ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !blueskyConnected) return;
    loadConvos();
  }, [isAuthenticated, blueskyConnected]);

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

  // ── Load messages for selected conversation ───────────────────────────────

  useEffect(() => {
    if (!selectedConvo) return;
    loadMessages(selectedConvo.id);
  }, [selectedConvo]);

  async function loadMessages(convoId: string) {
    setIsLoadingMessages(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/bluesky/dms/messages?convoId=${convoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Load mutual follows when new-message panel opens ─────────────────────

  useEffect(() => {
    if (!showNewMessage || mutuals.length > 0) return;
    loadMutuals();
    // Focus search immediately
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [showNewMessage]);

  async function loadMutuals() {
    setIsLoadingMutuals(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/bluesky/dms/mutual-follows", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMutuals(data.mutuals || []);
      }
    } catch (err) {
      console.error("[Messages] Failed to load mutual follows:", err);
    } finally {
      setIsLoadingMutuals(false);
    }
  }

  // ── Send a message ────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedConvo || isSending) return;
    const text = inputText.trim();
    setInputText("");
    setIsSending(true);

    // Optimistic update
    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      text,
      sentAt: new Date().toISOString(),
      sender: { did: blueskyProfile?.did ?? "" },
    };
    setMessages((prev) => [...prev, optimisticMsg]);

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
          // Replace optimistic message with real one
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticMsg.id ? { ...data.message, sender: { did: blueskyProfile?.did ?? "" } } : m))
          );
          // Update last message in convo list
          setConvos((prev) =>
            prev.map((c) =>
              c.id === selectedConvo.id
                ? { ...c, lastMessage: { text, sentAt: new Date().toISOString() }, unreadCount: 0 }
                : c
            )
          );
        }
      } else {
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setInputText(text);
        toast.error("Failed to send message");
      }
    } catch (err) {
      console.error("[Messages] Failed to send:", err);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInputText(text);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // ── Start a new conversation ──────────────────────────────────────────────

  async function startConvo(mutual: MutualFollow) {
    if (isStartingConvo) return;
    setIsStartingConvo(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/bluesky/dms/convo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ did: mutual.did }),
      });
      if (!res.ok) throw new Error("Failed to open conversation");
      const data = await res.json();
      const convo: Convo = data.convo;

      // Add to list if not already present
      setConvos((prev) => (prev.find((c) => c.id === convo.id) ? prev : [convo, ...prev]));
      setSelectedConvo(convo);
      setMessages([]);
      setShowNewMessage(false);
      setMutualsSearch("");
      setMobileView("thread");
    } catch (err) {
      console.error("[Messages] Failed to start convo:", err);
      toast.error("Could not open conversation");
    } finally {
      setIsStartingConvo(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getOtherMember = (convo: Convo): Participant | undefined =>
    convo.members.find((m) => m.did !== blueskyProfile?.did);

  const filteredMutuals = mutuals.filter((m) => {
    if (!mutualsSearch.trim()) return true;
    const q = mutualsSearch.toLowerCase();
    return m.displayName.toLowerCase().includes(q) || m.handle.toLowerCase().includes(q);
  });

  const selectConvo = (convo: Convo) => {
    setSelectedConvo(convo);
    setMessages([]);
    setMobileView("thread");
  };

  // ── Auth gates ────────────────────────────────────────────────────────────

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

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0d0620]">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
          <FiMessageCircle className="w-7 h-7 text-[#EB83EA]" />
          Messages
          <span className="text-sm font-normal text-gray-500">· mutual follows only</span>
        </h1>

        <div className="flex gap-0 rounded-3xl overflow-hidden border-2 border-[#EB83EA]/20 min-h-[70vh]">

          {/* ── Left: Conversation list / New Message picker ───────────────── */}
          <div
            className={`${
              mobileView === "thread" ? "hidden md:flex" : "flex"
            } w-full md:w-80 flex-shrink-0 bg-[#1a0b2e] border-r border-[#2f2942] flex-col`}
          >
            {/* Panel header */}
            <div className="p-4 border-b border-[#2f2942] flex items-center gap-2">
              {showNewMessage ? (
                <>
                  <button
                    onClick={() => { setShowNewMessage(false); setMutualsSearch(""); }}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition flex-shrink-0"
                    aria-label="Back to conversations"
                  >
                    <FiArrowLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <p className="text-sm text-gray-400 font-semibold uppercase tracking-wider flex-1">
                    New Message
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400 font-semibold uppercase tracking-wider flex-1">
                    Conversations
                  </p>
                  <button
                    onClick={() => setShowNewMessage(true)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-[#EB83EA]/20 hover:bg-[#EB83EA]/30 text-[#EB83EA] transition flex-shrink-0"
                    aria-label="New message"
                    title="New message"
                  >
                    <FiPlus className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* New Message: mutual-follow picker */}
            {showNewMessage ? (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Search */}
                <div className="px-3 py-2.5 border-b border-[#2f2942]">
                  <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                    <FiSearch className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={mutualsSearch}
                      onChange={(e) => setMutualsSearch(e.target.value)}
                      placeholder="Search mutual follows…"
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
                    />
                    {mutualsSearch && (
                      <button onClick={() => setMutualsSearch("")} aria-label="Clear search">
                        <FiX className="w-3.5 h-3.5 text-gray-500 hover:text-white" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mutual follows list */}
                <div className="flex-1 overflow-y-auto">
                  {isLoadingMutuals ? (
                    <div className="p-4 space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex gap-3 animate-pulse">
                          <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                          <div className="flex-1 space-y-2 py-1">
                            <div className="h-3 bg-white/10 rounded w-3/4" />
                            <div className="h-2 bg-white/10 rounded w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredMutuals.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-2 py-12">
                      <SiBluesky className="w-8 h-8 text-blue-400/40" />
                      <p className="text-gray-500 text-sm">
                        {mutualsSearch ? "No results" : "No mutual follows yet"}
                      </p>
                      {!mutualsSearch && (
                        <p className="text-gray-600 text-xs max-w-[200px]">
                          Follow creators on Bluesky — once they follow back, you can message them here.
                        </p>
                      )}
                    </div>
                  ) : (
                    filteredMutuals.map((mutual) => (
                      <button
                        key={mutual.did}
                        onClick={() => startConvo(mutual)}
                        disabled={isStartingConvo}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition border-b border-[#2f2942]/50 disabled:opacity-60"
                      >
                        {mutual.avatar ? (
                          <Image
                            src={mutual.avatar}
                            alt={mutual.displayName}
                            width={40}
                            height={40}
                            className="rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#EB83EA]/20 flex items-center justify-center text-[#EB83EA] font-bold flex-shrink-0">
                            {mutual.displayName[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{mutual.displayName}</p>
                          <p className="text-xs text-gray-400 truncate">@{mutual.handle}</p>
                        </div>
                        {isStartingConvo && (
                          <div className="w-4 h-4 border-2 border-[#EB83EA] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Conversations list */
              <>
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
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
                    <FiMessageCircle className="w-10 h-10 text-gray-600" />
                    <p className="text-gray-400 text-sm font-semibold">No conversations yet</p>
                    <p className="text-gray-600 text-xs max-w-[200px]">
                      Tap <strong className="text-[#EB83EA]">+</strong> to message a mutual follow.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    {convos.map((convo) => {
                      const other = getOtherMember(convo);
                      const isSelected = selectedConvo?.id === convo.id;
                      return (
                        <button
                          key={convo.id}
                          onClick={() => selectConvo(convo)}
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
              </>
            )}
          </div>

          {/* ── Right: Message thread ──────────────────────────────────────── */}
          <div
            className={`${
              mobileView === "list" ? "hidden md:flex" : "flex"
            } flex-1 flex-col bg-[#12082a]`}
          >
            {!selectedConvo ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3">
                <FiMessageCircle className="w-12 h-12 opacity-30" />
                <p className="text-sm">Select a conversation or start a new one</p>
                <button
                  onClick={() => setShowNewMessage(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#EB83EA]/20 hover:bg-[#EB83EA]/30 text-[#EB83EA] text-sm font-semibold transition mt-1"
                >
                  <FiPlus className="w-4 h-4" />
                  New Message
                </button>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="p-4 border-b border-[#2f2942] flex items-center gap-3">
                  {/* Mobile back button */}
                  <button
                    className="md:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition flex-shrink-0"
                    onClick={() => setMobileView("list")}
                    aria-label="Back to conversations"
                  >
                    <FiArrowLeft className="w-4 h-4 text-gray-400" />
                  </button>
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
                            className="rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#EB83EA]/20 flex items-center justify-center text-[#EB83EA] font-bold flex-shrink-0">
                            {(other?.displayName || other?.handle || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-white text-sm truncate">
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
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                      Loading…
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
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
                            className={`max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm break-words ${
                              isMine
                                ? "bg-[#EB83EA] text-black rounded-br-sm"
                                : "bg-[#2f2942] text-white rounded-bl-sm"
                            } ${msg.id.startsWith("optimistic-") ? "opacity-70" : ""}`}
                          >
                            <p>{msg.text}</p>
                            <p
                              className={`text-[10px] mt-1 ${
                                isMine ? "text-black/60" : "text-gray-500"
                              }`}
                            >
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
                <div className="p-4 border-t border-[#2f2942] flex gap-2 items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message…"
                    maxLength={1000}
                    className="flex-1 px-4 py-2.5 bg-[#2f2942] border border-[#EB83EA]/20 rounded-full text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#EB83EA] transition"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputText.trim() || isSending}
                    className="p-2.5 bg-[#EB83EA] hover:bg-[#E748E6] disabled:opacity-40 rounded-full transition flex-shrink-0"
                    aria-label="Send message"
                  >
                    {isSending ? (
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiSend className="w-4 h-4 text-black" />
                    )}
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
