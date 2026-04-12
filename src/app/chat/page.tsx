"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { queueWrite } from "@/lib/sync";
import PixelIcon from "@/components/PixelIcon";
import Markdown from "@/components/Markdown";

interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  capability?: string;
}

interface ChatSession {
  id: number;
  title: string | null;
  created_at: string;
}

const CAPABILITIES = [
  { key: "focus", label: "Focus", icon: "🎯", hint: "What should I focus on today?" },
  { key: "review", label: "Review", icon: "🔄", hint: "How did my week go?" },
  { key: "spending", label: "Spending", icon: "💰", hint: "How's my spending looking?" },
  { key: "journal", label: "Journal", icon: "📔", hint: "Give me a journalling prompt" },
  { key: "general", label: "General", icon: "💬", hint: "" },
];

const CAPABILITY_STYLES: Record<string, string> = {
  focus: "bg-desert-accent-dim text-desert-accent border-desert-accent/30",
  review: "bg-desert-mystic/20 text-desert-mystic border-desert-mystic/30",
  spending: "bg-desert-success-dim text-desert-success border-desert-success/30",
  journal: "bg-desert-warning-dim text-desert-warning border-desert-warning/30",
  general: "bg-desert-celestial/20 text-desert-celestial border-desert-celestial/30",
};

export default function ChatPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [capability, setCapability] = useState("general");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchSessions = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("chat_sessions")
      .select("id, title, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setSessions(data || []);
  };

  useEffect(() => {
    if (userId) fetchSessions();
  }, [userId]);

  const loadSession = async (id: number) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, role, content, capability")
      .eq("session_id", id)
      .order("created_at", { ascending: true });
    setMessages((data as ChatMessage[]) || []);
    setSessionId(id);
  };

  const newChat = () => {
    setMessages([]);
    setSessionId(null);
    setInput("");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const selectCapability = (key: string) => {
    setCapability(key);
    const cap = CAPABILITIES.find((c) => c.key === key);
    if (cap?.hint) setInput(cap.hint);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          capability,
          sessionId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${err.error || "Something went wrong"}`,
          },
        ]);
        setSending(false);
        return;
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response, capability },
      ]);

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        fetchSessions();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: Failed to connect" },
      ]);
    }

    setSending(false);
  };

  const saveToKB = async (content: string) => {
    if (!userId) return;
    const { error } = await supabase.from("kb_notes").insert({
      user_id: userId,
      title: `AI Chat — ${new Date().toLocaleDateString("en-NZ")}`,
      content,
      type: "ai_response",
    });
    if (error) {
      await queueWrite("kb_notes", "insert", {
        user_id: userId,
        title: `AI Chat — ${new Date().toLocaleDateString("en-NZ")}`,
        content,
        type: "ai_response",
      });
    }
    if (!error) alert("Saved to Knowledge Base");
  };

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-desert-border">
          <div>
            <h1 className="font-pixel text-lg text-desert-text flex items-center gap-3"><PixelIcon name="chat" size={18} className="text-desert-accent" /> AI Chat</h1>
            <p className="text-desert-text-3 mt-1">Your Life OS assistant</p>
          </div>
          <div className="flex items-center gap-3">
            {sessions.length > 0 && (
              <select
                value={sessionId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) loadSession(parseInt(val));
                  else newChat();
                }}
                className="bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text font-mono text-sm focus:outline-none focus:border-desert-accent transition-colors max-w-[200px]"
              >
                <option value="">New chat</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || `Chat ${s.id}`}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={newChat}
              className="px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150"
            >
              + New
            </button>
          </div>
        </div>

        {/* Capability pills */}
        <div className="flex gap-2 flex-wrap mb-4">
          {CAPABILITIES.map((cap) => (
            <button
              key={cap.key}
              onClick={() => selectCapability(cap.key)}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs uppercase tracking-wider border transition-colors ${
                capability === cap.key
                  ? CAPABILITY_STYLES[cap.key]
                  : "bg-desert-surface border-desert-border text-desert-text-3 hover:text-desert-text-2"
              }`}
            >
              {cap.icon} {cap.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-desert-text-3 text-sm mb-2">
                Select a capability and ask a question
              </p>
              <p className="text-desert-text-3 text-xs">
                Focus, Review, Spending, and Journal modes pull live data from your Life OS
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl mx-auto">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-sm p-3 ${
                    msg.role === "user"
                      ? "bg-desert-accent/20 text-desert-text"
                      : "bg-desert-surface border border-desert-border text-desert-text"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Markdown content={msg.content} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.role === "assistant" && (
                    <button
                      onClick={() => saveToKB(msg.content)}
                      className="mt-2 text-desert-text-3 hover:text-desert-accent font-mono text-[10px] uppercase tracking-wider transition-colors"
                    >
                      Save to KB
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-desert-surface border border-desert-border rounded-sm p-3">
                  <p className="text-desert-text-3 text-sm animate-pulse">Thinking...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 pt-0">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            placeholder="Ask your Life OS assistant..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            disabled={sending}
            className="flex-1 bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-3 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="px-6 py-3 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
