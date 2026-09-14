import { Router } from 'express';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { openai, OPENAI_MODEL } from '../lib/openai';
import { predictEvent, type EventPrediction } from '../lib/predict';
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
              "Best-guess category if the event name alone has no history — used as a fallback so a brand-new event still gets a same-category estimate instead of one blended across all event types. Null if you can't tell.",
          },
        },
        required: ['event_name', 'category'],
        additionalProperties: false,
      },
    },
  },
];

const FINAL_SCHEMA = {
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
  },
  required: ['reply', 'event_name', 'event_date', 'needs_date', 'should_draft_tasks'],
  additionalProperties: false,
};

function systemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the GEO (Global Engagement Office) event platform's planning assistant, used by university event coordinators and student volunteers.
Today's date is ${today}.

When the user mentions a next/upcoming event, extract the event name. Call lookup_event_history with that name before saying anything about attendance or food numbers — never invent those statistics yourself, always use the tool result. Also pass your best-guess category (Cultural, Community, or Professional) if you can tell one from the event name/context — it's used as a fallback when there's no exact history for that event name, so an unrecognized event still gets a same-category estimate instead of one blended across every past event. Pass null if you genuinely can't tell.

The tool result includes an attendance range and a confidence level that already accounts for how volatile that event's history has been — always mention the range (not just the single number) and the confidence level in your reply, since a tight range means the number is trustworthy and a wide one means it should be treated as a rough guide.

If the user hasn't given a date for the event, set needs_date=true, leave event_date null, and ask for the date in your reply. If a date is given or inferable (e.g. "next October", "March 14"), resolve it to an ISO YYYY-MM-DD date and set needs_date=false. When only a month/day is given (no year), use THIS year (from today's date above) if that month/day has not yet occurred this year, and only roll over to next year if it has already passed this year — do not jump to next year just because the year wasn't stated explicitly.

Task drafting is a separate, explicit step — it is NOT automatic just because an event and date are known. Only set should_draft_tasks=true when the user's CURRENT message explicitly asks you to draft, assign, or create the tasks (e.g. "assign tasks", "draft the task list", "create the plan"). On every other message — even ones where you already know the event and date from earlier in the conversation — set should_draft_tasks=false. You have no ability to actually pick or list individual tasks yourself: the app has a fixed, pre-approved planning checklist it draws from and splits evenly across the student roster once should_draft_tasks is true. So when should_draft_tasks is true, do NOT invent your own list of roles or tasks in your reply — just confirm you're drafting the standard planning checklist and that a Coordinator needs to approve it on the Review page before it's assigned to any student.

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
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt() },
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
          ? await predictEvent(eventName, args.category)
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
        json_schema: { name: 'chat_reply', schema: FINAL_SCHEMA, strict: true },
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
    };

    res.json({
      reply: structured.reply,
      eventName: structured.event_name,
      eventDate: structured.event_date,
      needsDate: structured.needs_date,
      shouldDraftTasks: structured.should_draft_tasks,
      prediction,
      category,
    });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI chat failed' });
  }
});
