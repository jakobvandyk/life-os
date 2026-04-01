import { createClient } from "@/lib/supabase-server";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildFocusContext,
  buildReviewContext,
  buildSpendingContext,
  buildJournalContext,
} from "@/lib/ai/context-builders";

const anthropic = new Anthropic();

const SYSTEM_IDENTITY = `You are Jakob's personal Life OS assistant. You have access to his live data.
Be concise, direct, and practical. Use plain text unless markdown genuinely helps.
Jakob is based in Hamilton, New Zealand. Currency is NZD.`;

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, capability, sessionId } = await request.json();

  if (!message || !capability) {
    return Response.json(
      { error: "message and capability are required" },
      { status: 400 }
    );
  }

  // Build context based on capability
  let context = "";
  switch (capability) {
    case "focus":
      context = await buildFocusContext(supabase, user.id);
      break;
    case "review":
      context = await buildReviewContext(supabase, user.id, getMonday());
      break;
    case "spending":
      context = await buildSpendingContext(supabase, user.id);
      break;
    case "journal":
      context = await buildJournalContext(supabase, user.id);
      break;
    case "general":
      context = "No specific data context. Answer based on general knowledge.";
      break;
  }

  const systemPrompt = `${SYSTEM_IDENTITY}\n\n--- LIVE DATA ---\n${context}`;

  // Get or create session
  let chatSessionId = sessionId;
  if (!chatSessionId) {
    const { data: newSession } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title: message.slice(0, 50) })
      .select("id")
      .single();
    chatSessionId = newSession?.id;
  }

  // Fetch prior messages in this session for conversation context
  const { data: priorMessages } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", chatSessionId)
    .order("created_at", { ascending: true })
    .limit(20);

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...((priorMessages || []) as { role: "user" | "assistant"; content: string }[]),
    { role: "user", content: message },
  ];

  // Call Anthropic
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const assistantContent =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Save both messages
  await supabase.from("chat_messages").insert([
    {
      user_id: user.id,
      session_id: chatSessionId,
      role: "user",
      content: message,
      capability,
    },
    {
      user_id: user.id,
      session_id: chatSessionId,
      role: "assistant",
      content: assistantContent,
      capability,
    },
  ]);

  return Response.json({
    response: assistantContent,
    sessionId: chatSessionId,
  });
}
