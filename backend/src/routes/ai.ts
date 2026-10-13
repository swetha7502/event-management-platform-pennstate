import { Router } from 'express';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { openai, OPENAI_MODEL } from '../lib/openai';
import { predictEvent, predictionFromCoordinatorCount, type EventPrediction } from '../lib/predict';
import { supabase } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';

export const aiRouter = Router();

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'lookup_event_history',
      strict: true,
      description:
        'Look up real historical attendance and food-order data for past events matching a given event name. Always call this before stating any attendance or food number for a named event — never invent those numbers yourself.',
      parameters: {
        type: 'object',
        properties: {
          event_name: {
            type: 'string',
            description: 'The event name to look up, e.g. "Diwali" or "Holi".',
          },
          category: {
            type: ['string', 'null'],
            enum: ['Cultural', 'Community', 'Professional', null],
            description:
              "Best-guess category for the event (used to tag the event record). Null if you can't tell.",
          },
        },
        required: ['event_name', 'category'],
        additionalProperties: false,
      },
    },
  },
];

interface RosterStudent {
  user_id: string;
  name: string;
}

// Built per request so student_names can be an enum of the real roster
// — with strict structured output the model can only ever return names
// that actually exist, never a misspelled or invented one.
function finalSchema(roster: RosterStudent[]) {
  return {
    type: 'object',
    properties: {
      reply: {
        type: 'string',
        description: 'Natural-language reply to show the user in the chat, 2-4 sentences.',
      },
      event_name: {
        type: ['string', 'null'],
        description: 'The event name the user is planning, if any.',
      },
      event_date: {
        type: ['string', 'null'],
        description: 'ISO date (YYYY-MM-DD) of the event if it can be resolved, else null.',
      },
      needs_date: {
        type: 'boolean',
        description: 'True if an event was mentioned but no date could be resolved yet.',
      },
      should_draft_tasks: {
        type: 'boolean',
        description:
          'True ONLY if the user is explicitly asking, in THIS message, to draft/assign/create the task list (e.g. "assign tasks", "create the task list", "draft the plan"). False otherwise — including on earlier messages that only mention the event and date without asking for tasks yet.',
      },
      expected_attendance: {
        type: ['integer', 'null'],
        description:
          'The number of attendees the user has said they expect for THIS event, anywhere in the conversation (e.g. "we expect about 150 people"). Null if they have not stated one. Never fill this from historical data.',
      },
      student_names: {
        type: 'array',
        items: roster.length ? { type: 'string', enum: roster.map((s) => s.name) } : { type: 'string' },
        description:
          'Students the user has said should work on THIS event, anywhere in the conversation, matched to the roster. Empty if they have not named any.',
      },
    },
    required: [
      'reply',
      'event_name',
      'event_date',
      'needs_date',
      'should_draft_tasks',
      'expected_attendance',
      'student_names',
    ],
    additionalProperties: false,
  };
}

function systemPrompt(roster: RosterStudent[]) {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the GEO (Global Engagement Office) event platform's planning assistant, used by university event coordinators and student volunteers.
Today's date is ${today}.

When the user mentions a next/upcoming event, extract the event name. Call lookup_event_history with that name before saying anything about attendance or food numbers — never invent those statistics yourself, always use the tool result. Also pass your best-guess category (Cultural, Community, or Professional) if you can tell one from the event name/context, or null if you can't.

If the tool finds history, it returns an attendance range and a confidence level that already accounts for how volatile that event's history has been — mention the range (not just the single number) and the confidence level in your reply.

If the tool finds NO history (predictedAttendance is null), this is a new event: say plainly that there's no past data for it, do NOT state or guess any attendance or food number, and ask the user whether they know roughly how many people to expect. A missing attendance number never blocks anything else — if the user asks to draft/assign tasks without giving one, draft them anyway.

If the user tells you how many people they expect (e.g. "we're expecting around 200"), believe them: set expected_attendance to that number, use it as THE attendance figure in your reply (food is that number plus a 5% buffer), and do not contradict or "correct" it with historical data. Keep expected_attendance set on later messages about the same event.

If the user hasn't given a date for the event, set needs_date=true, leave event_date null, and ask for the date in your reply. If a date is given or inferable (e.g. "next October", "March 14"), resolve it to an ISO YYYY-MM-DD date and set needs_date=false. When only a month/day is given (no year), use THIS year (from today's date above) if that month/day has not yet occurred this year, and only roll over to next year if it has already passed this year — do not jump to next year just because the year wasn't stated explicitly.

Not every student works on every event. The student roster is: ${roster.length ? roster.map((s) => s.name).join(', ') : '(no students on record)'}. When the user names which students should work on this event (full or first names, e.g. "use Priya and Alex"), put their exact roster names in student_names, and keep them there on later messages about the same event. If a name is ambiguous (matches more than one roster student) or isn't on the roster, leave it out and ask the user to clarify in your reply.

Task drafting is a separate, explicit step — it is NOT automatic just because an event and date are known. Only set should_draft_tasks=true when the user's CURRENT message explicitly asks you to draft, assign, or create the tasks (e.g. "assign tasks", "draft the task list", "create the plan"). On every other message — even ones where you already know the event and date from earlier in the conversation — set should_draft_tasks=false. You have no ability to actually pick or list individual tasks yourself: the app has a fixed, pre-approved planning checklist it draws from and splits evenly across ONLY the students in student_names. So when should_draft_tasks is true, do NOT invent your own list of roles or tasks in your reply — just confirm you're drafting the standard planning checklist, say which students it will be split across (or, if student_names is empty, that tasks will be left unassigned for a Coordinator to assign), and that a Coordinator needs to approve it on the Review page before it's assigned to any student.

If the message isn't about planning a specific event, just answer helpfully and leave event_name/event_date null with needs_date=false and should_draft_tasks=false.

Keep replies concise, friendly, and specific to GEO's cultural/professional/community campus events.`;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

aiRouter.post('/chat', requireAuth, async (req, res) => {
  const { message, history } = req.body as { message?: string; history?: ChatTurn[] };
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const { data: rosterRows, error: rosterErr } = await supabase
      .from('users')
      .select('user_id, name')
      .eq('role', 'Student')
      .order('name', { ascending: true });
    if (rosterErr) throw rosterErr;
    const roster = (rosterRows ?? []) as RosterStudent[];

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt(roster) },
      ...((history ?? []) as ChatCompletionMessageParam[]),
      { role: 'user', content: message },
    ];

    const first = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
    });

    const firstMessage = first.choices[0].message;
    let prediction: EventPrediction | null = null;
    let category: string | null = null;

    messages.push(firstMessage);

    if (firstMessage.tool_calls?.length) {
      for (const toolCall of firstMessage.tool_calls) {
        if (toolCall.type !== 'function' || toolCall.function.name !== 'lookup_event_history') continue;
        const args = JSON.parse(toolCall.function.arguments || '{}') as {
          event_name?: string;
          category?: string | null;
        };
        const eventName = args.event_name?.trim();
        category = args.category ?? null;
        const result = eventName
          ? await predictEvent(eventName)
          : {
              matchedEventCount: 0,
              predictedAttendance: null,
              attendanceRange: null,
              confidence: 'low' as const,
              recommendedFoodCount: null,
              basisNote: 'No event name given.',
            };
        prediction = result;
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    const final = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'chat_reply', schema: finalSchema(roster), strict: true },
      },
    });

    const raw = final.choices[0].message.content;
    if (!raw) return res.status(502).json({ error: 'Empty response from model' });
    const structured = JSON.parse(raw) as {
      reply: string;
      event_name: string | null;
      event_date: string | null;
      needs_date: boolean;
      should_draft_tasks: boolean;
      expected_attendance: number | null;
      student_names: string[];
    };

    // The model doesn't always re-call the tool on a follow-up turn
    // (e.g. "assign tasks"), so fill the prediction in here rather than
    // making drafting depend on whether it happened to.
    if (!prediction && structured.event_name) {
      prediction = await predictEvent(structured.event_name);
    }
    if (structured.expected_attendance !== null && structured.expected_attendance > 0) {
      prediction = predictionFromCoordinatorCount(structured.expected_attendance);
    }

    // gpt-4o-mini sometimes resolves a year-less date like "March 14" to
    // this year even after it's passed, despite the prompt. Planning is
    // always forward-looking, so roll a past date forward a year — unless
    // the user actually typed that year, in which case it was deliberate.
    if (structured.event_date) {
      const today = new Date().toISOString().slice(0, 10);
      const year = structured.event_date.slice(0, 4);
      const userText = [...(history ?? []).filter((t) => t.role === 'user').map((t) => t.content), message].join(' ');
      if (structured.event_date < today && !userText.includes(year)) {
        structured.event_date = `${Number(year) + 1}${structured.event_date.slice(4)}`;
      }
    }

    const named = new Set(structured.student_names);
    const assignedStudents = roster.filter((s) => named.has(s.name));

    res.json({
      reply: structured.reply,
      eventName: structured.event_name,
      eventDate: structured.event_date,
      needsDate: structured.needs_date,
      shouldDraftTasks: structured.should_draft_tasks,
      prediction,
      category,
      assignedStudents,
    });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI chat failed' });
  }
});
