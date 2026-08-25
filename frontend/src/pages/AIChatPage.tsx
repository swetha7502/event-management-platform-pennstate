import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Sparkles, ClipboardList, RotateCcw, ClipboardCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDraft } from "../context/DraftContext";
import { getStudents } from "../lib/dataClient";
import { sendChatMessage } from "../lib/aiClient";
import { EVENT_TASK_TEMPLATE } from "../data/taskTemplates";
import type { DraftTaskItem } from "../context/DraftContext";
import type { AiPrediction, ChatTurn } from "../lib/aiClient";

interface ChatMessage {
  from: "ai" | "user";
  text: string;
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

// Chat history persistence: browser localStorage, keyed per user, not
// a Supabase table. Survives page navigation/reloads on this device;
// does not sync across devices or browsers — that would need a real
// chat_messages table (a schema change), not done here.
const CHAT_STORAGE_PREFIX = "geo-chat-";

interface StoredChat {
  messages: ChatMessage[];
  history: ChatTurn[];
}

function loadStoredChat(key: string): StoredChat | null {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as StoredChat) : null;
  } catch {
    return null;
  }
}

export default function AIChatPage() {
  const { session } = useAuth();
  const { pendingDraft, setPendingDraft } = useDraft();
  const storageKey = session?.userId ?? session?.name ?? "anon";

  const [messages, setMessages] = useState<ChatMessage[]>(
    () => loadStoredChat(storageKey)?.messages ?? [INITIAL_MESSAGE]
  );
  const [history, setHistory] = useState<ChatTurn[]>(() => loadStoredChat(storageKey)?.history ?? []);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [readyToAssign, setReadyToAssign] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_PREFIX + storageKey, JSON.stringify({ messages, history }));
    } catch {
      // storage full/unavailable — non-fatal, chat just won't persist
    }
  }, [messages, history, storageKey]);

  const say = (text: string) => setMessages((m) => [...m, { from: "ai", text }]);

  const buildDraft = async (
    eventName: string,
    eventDateISO: string,
    prediction: AiPrediction,
    category: string | null
  ) => {
    const eventDate = new Date(eventDateISO + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const students = await getStudents();

    const tasks: DraftTaskItem[] = EVENT_TASK_TEMPLATE.map((t, i) => {
      const due = new Date(eventDate);
      due.setDate(due.getDate() + t.dayOffset);
      if (t.dayOffset < 0 && due < today) due.setTime(today.getTime());
      const student = students.length ? students[i % students.length] : null;
      return {
        id: `dt-${i}`,
        title: t.title,
        description: t.description,
        phase: t.phase,
        due_date: due.toISOString().slice(0, 10),
        assigned_to: student?.user_id ?? null,
        assigneeName: student?.name ?? "Unassigned",
        status: "pending",
      };
    });

    setPendingDraft({
      eventTitle: titleCase(eventName),
      eventDate: eventDateISO,
      culturalTag: category,
      predictedAttendance: prediction.predictedAttendance,
      attendanceRange: prediction.attendanceRange,
      predictionConfidence: prediction.confidence,
      recommendedFoodCount: prediction.recommendedFoodCount,
      basisNote: prediction.basisNote,
      tasks,
      eventId: null,
    });
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || thinking) return;
    setMessages((m) => [...m, { from: "user", text }]);
    setInput("");
    setThinking(true);
    setReadyToAssign(null);

    try {
      const res = await sendChatMessage(text, history, session?.userId);
      setHistory((h) => [
        ...h,
        { role: "user", content: text },
        { role: "assistant", content: res.reply },
      ]);
      say(res.reply);

      if (res.shouldDraftTasks && res.eventName && res.eventDate && !res.needsDate && res.prediction) {
        await buildDraft(res.eventName, res.eventDate, res.prediction, res.category);
        say(`Draft ready — head to the Review page to approve it, task by task.`);
      } else if (res.eventName && res.eventDate && !res.needsDate) {
        setReadyToAssign(res.eventName);
      }
    } catch {
      say("I couldn't reach the planning assistant just now — try again in a bit.");
    }
    setThinking(false);
  };

  const handleSend = () => submitMessage(input.trim());

  const handleReset = () => {
    setMessages([INITIAL_MESSAGE]);
    setHistory([]);
    setReadyToAssign(null);
    setInput("");
    try {
      localStorage.removeItem(CHAT_STORAGE_PREFIX + storageKey);
    } catch {
      // ignore
    }
  };

  const showSuggestions = messages.length === 1;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-indigo-700 px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-blue-100" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">Planning Assistant</p>
          <p className="text-blue-200 text-xs">Predicts attendance · drafts tasks</p>
        </div>
        <button
          onClick={handleReset}
          title="Start a new chat (clears saved history on this device)"
          className="text-blue-200 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors shrink-0"
        >
          <RotateCcw size={15} />
        </button>
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
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex items-end gap-2 ${m.from === "user" ? "flex-row-reverse" : ""}`}
          >
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
  );
}
