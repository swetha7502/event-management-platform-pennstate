import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Sparkles, ClipboardList, Plus, MessageSquare, Trash2, ClipboardCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDraft } from "../context/DraftContext";
import { getStudents, createDraftPlan } from "../lib/dataClient";
import { sendChatMessage } from "../lib/aiClient";
import { EVENT_TASK_TEMPLATE } from "../data/taskTemplates";
import type { AiPrediction, ChatTurn } from "../lib/aiClient";

interface ChatMessage {
  from: "ai" | "user";
  text: string;
}

interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  history: ChatTurn[];
  updatedAt: string;
}

const INITIAL_MESSAGE: ChatMessage = {
  from: "ai",
  text: "Hi! Tell me your next event and roughly when it's happening, and I'll estimate turnout and recommend a food order based on past events. When you're ready, I'll draft a starter task list for a Coordinator to review — nothing goes to any student until it's approved.",
};

const SUGGESTIONS = [
  "Diwali is on November 1st 2027",
  "Navratri is next October",
  "How did Worldfest do last year?",
];

function titleCase(s: string) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Chat history: multiple threads, ChatGPT/Claude-style, kept in browser
// localStorage per user — not a Supabase table. Survives reloads/nav on
// this device; doesn't sync across devices or browsers (would need a
// real chat_threads table, a schema change, not done here).
const THREADS_PREFIX = "geo-chat-threads-";
const ACTIVE_PREFIX = "geo-chat-active-";

function makeNewThread(): ChatThread {
  return {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "New chat",
    messages: [INITIAL_MESSAGE],
    history: [],
    updatedAt: new Date().toISOString(),
  };
}

function loadThreads(key: string): ChatThread[] {
  try {
    const raw = localStorage.getItem(THREADS_PREFIX + key);
    const parsed = raw ? (JSON.parse(raw) as ChatThread[]) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fall through to fresh thread
  }
  return [makeNewThread()];
}

export default function AIChatPage() {
  const { session } = useAuth();
  const { pendingDraft, refreshDraft } = useDraft();
  const storageKey = session?.userId ?? session?.name ?? "anon";

  const [threads, setThreads] = useState<ChatThread[]>(() => loadThreads(storageKey));
  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    const loaded = loadThreads(storageKey);
    const stored = localStorage.getItem(ACTIVE_PREFIX + storageKey);
    return stored && loaded.some((t) => t.id === stored) ? stored : loaded[0].id;
  });
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [readyToAssign, setReadyToAssign] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? threads[0];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread.messages, thinking]);

  useEffect(() => {
    try {
      localStorage.setItem(THREADS_PREFIX + storageKey, JSON.stringify(threads));
    } catch {
      // storage full/unavailable — non-fatal, chat just won't persist
    }
  }, [threads, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_PREFIX + storageKey, activeThreadId);
    } catch {
      // ignore
    }
  }, [activeThreadId, storageKey]);

  const appendMessage = (threadId: string, msg: ChatMessage) => {
    setThreads((ts) =>
      ts.map((t) => (t.id === threadId ? { ...t, messages: [...t.messages, msg], updatedAt: new Date().toISOString() } : t))
    );
  };

  const appendHistory = (threadId: string, turns: ChatTurn[]) => {
    setThreads((ts) => ts.map((t) => (t.id === threadId ? { ...t, history: [...t.history, ...turns] } : t)));
  };

  const maybeSetTitle = (threadId: string, text: string) => {
    setThreads((ts) =>
      ts.map((t) => {
        if (t.id !== threadId || t.title !== "New chat") return t;
        return { ...t, title: text.length > 40 ? text.slice(0, 40) + "…" : text };
      })
    );
  };

  const buildDraft = async (
    threadId: string,
    eventName: string,
    eventDateISO: string,
    prediction: AiPrediction,
    category: string | null
  ) => {
    if (!session?.userId) {
      appendMessage(threadId, { from: "ai", text: "I couldn't resolve your account to save this draft — try logging in again." });
      return;
    }
    const eventDate = new Date(eventDateISO + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const students = await getStudents();

    const tasks = EVENT_TASK_TEMPLATE.map((t, i) => {
      const due = new Date(eventDate);
      due.setDate(due.getDate() + t.dayOffset);
      if (t.dayOffset < 0 && due < today) due.setTime(today.getTime());
      const student = students.length ? students[i % students.length] : null;
      return {
        title: t.title,
        description: t.description,
        phase: t.phase,
        due_date: due.toISOString().slice(0, 10),
        assigned_to: student?.user_id ?? null,
        assigneeName: student?.name ?? "Unassigned",
      };
    });

    await createDraftPlan({
      eventTitle: titleCase(eventName),
      eventDate: eventDateISO,
      culturalTag: category,
      predictedAttendance: prediction.predictedAttendance,
      attendanceRange: prediction.attendanceRange,
      predictionConfidence: prediction.confidence,
      recommendedFoodCount: prediction.recommendedFoodCount,
      basisNote: prediction.basisNote,
      createdBy: session.userId,
      tasks,
    });
    await refreshDraft();
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || thinking) return;
    const threadId = activeThreadId;
    const historySoFar = threads.find((t) => t.id === threadId)?.history ?? [];

    appendMessage(threadId, { from: "user", text });
    maybeSetTitle(threadId, text);
    setInput("");
    setThinking(true);
    setReadyToAssign(null);

    try {
      const res = await sendChatMessage(text, historySoFar);
      appendHistory(threadId, [
        { role: "user", content: text },
        { role: "assistant", content: res.reply },
      ]);
      appendMessage(threadId, { from: "ai", text: res.reply });

      if (res.shouldDraftTasks && res.eventName && res.eventDate && !res.needsDate && res.prediction) {
        await buildDraft(threadId, res.eventName, res.eventDate, res.prediction, res.category);
        appendMessage(threadId, { from: "ai", text: "Draft ready — head to the Review page to approve it, task by task." });
      } else if (res.eventName && res.eventDate && !res.needsDate) {
        setReadyToAssign(res.eventName);
      }
    } catch {
      appendMessage(threadId, { from: "ai", text: "I couldn't reach the planning assistant just now — try again in a bit." });
    }
    setThinking(false);
  };

  const handleSend = () => submitMessage(input.trim());

  const handleNewThread = () => {
    if (thinking) return;
    const t = makeNewThread();
    setThreads((ts) => [t, ...ts]);
    setActiveThreadId(t.id);
    setReadyToAssign(null);
    setInput("");
  };

  const handleDeleteThread = (id: string) => {
    if (thinking) return;
    const remaining = threads.filter((t) => t.id !== id);
    if (remaining.length === 0) {
      const fresh = makeNewThread();
      setThreads([fresh]);
      setActiveThreadId(fresh.id);
    } else {
      setThreads(remaining);
      if (id === activeThreadId) setActiveThreadId(remaining[0].id);
    }
  };

  const handleSwitchThread = (id: string) => {
    if (thinking || id === activeThreadId) return;
    setActiveThreadId(id);
    setReadyToAssign(null);
  };

  const sortedThreads = [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const showSuggestions = activeThread.messages.length === 1;

  return (
    <div className="flex h-[calc(100vh-140px)] gap-4">
      {/* Chat history sidebar */}
      <div className="w-64 shrink-0 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-200">
          <button
            onClick={handleNewThread}
            disabled={thinking}
            className="w-full flex items-center justify-center gap-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-medium py-2 rounded-lg transition-colors"
          >
            <Plus size={14} /> New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sortedThreads.map((t) => (
            <div
              key={t.id}
              onClick={() => handleSwitchThread(t.id)}
              className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-2 cursor-pointer text-xs transition-colors ${
                t.id === activeThreadId ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50"
              } ${thinking ? "pointer-events-none opacity-60" : ""}`}
            >
              <MessageSquare size={12} className="shrink-0 opacity-60" />
              <span className="flex-1 truncate">{t.title}</span>
              {threads.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteThread(t.id);
                  }}
                  title="Delete chat"
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm min-w-0">
        <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-indigo-700 px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-blue-100" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{activeThread.title}</p>
            <p className="text-blue-200 text-xs">Predicts attendance · drafts tasks</p>
          </div>
        </div>

        {pendingDraft && (
          <Link
            to="/review"
            className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-medium px-5 py-2.5 hover:bg-amber-100 transition-colors"
          >
            <ClipboardList size={14} />
            Draft ready for {pendingDraft.eventTitle} — go to Review page to approve
          </Link>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-gradient-to-b from-slate-50 to-white">
          {activeThread.messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-2 ${m.from === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                  m.from === "ai" ? "bg-blue-100 text-blue-700" : "bg-blue-700 text-white"
                }`}
              >
                {m.from === "ai" ? <Sparkles size={13} /> : initials(session?.name ?? "You")}
              </div>
              <div
                className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  m.from === "ai"
                    ? "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"
                    : "bg-blue-700 text-white rounded-br-sm"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center bg-blue-100 text-blue-700 shrink-0">
                <Sparkles size={13} />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" />
              </div>
            </div>
          )}

          {showSuggestions && !thinking && (
            <div className="flex flex-wrap gap-2 pl-9">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submitMessage(s)}
                  className="text-xs bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 px-3 py-1.5 rounded-full transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {readyToAssign && !thinking && (
            <div className="pl-9">
              <button
                onClick={() => submitMessage("Assign tasks")}
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-sm transition-colors"
              >
                <ClipboardCheck size={14} />
                Assign tasks for {readyToAssign}
              </button>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        <div className="p-3 border-t border-slate-200 flex gap-2 bg-white">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder='Try: "next event is Diwali, November 1st"'
            disabled={thinking}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={thinking}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white px-4 rounded-lg flex items-center justify-center transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
