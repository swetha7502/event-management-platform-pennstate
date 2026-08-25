export type EventPhase = "before" | "during" | "after";

export interface TaskTemplateItem {
  title: string;
  description: string;
  phase: EventPhase;
  // Days relative to the event date: negative = before, 0 = day-of,
  // positive = after. Replaces the old before-only "daysBeforeEvent".
  dayOffset: number;
}

// Full GEO event planning process (team process doc, Aug 2026). Used by
// the AI chat to draft a starter task list when a Coordinator explicitly
// asks to assign tasks. Always goes through per-task Coordinator
// approval on the Review page before anything is created or assigned.
export const EVENT_TASK_TEMPLATE: TaskTemplateItem[] = [
  // --- Before ---
  {
    title: "Book location on 25Live",
    description: "Reserve the venue as early as possible.",
    phase: "before",
    dayOffset: -45,
  },
  {
    title: "Check for campus conflicts",
    description: "Confirm there are no time/place conflicts with other campus events.",
    phase: "before",
    dayOffset: -45,
  },
  {
    title: "Decide: Food & Housing vs. outside caterer",
    description: "Choose the catering approach for this event.",
    phase: "before",
    dayOffset: -40,
  },
  {
    title: "ISO Assistant Director validation (if outside caterer)",
    description: "If using an outside caterer, route it through the ISO Assistant Director validation process.",
    phase: "before",
    dayOffset: -35,
  },
  {
    title: "Recruit & pre-assign volunteer GAs",
    description: "Assign volunteers to roles: registration, catering, decorations, wind-up team.",
    phase: "before",
    dayOffset: -30,
  },
  {
    title: "Assign event photographer team",
    description: "3–4 GAs to cover photos and video for the event.",
    phase: "before",
    dayOffset: -30,
  },
  {
    title: "Assign event scribe team",
    description: "3–4 GAs to write the event reflection.",
    phase: "before",
    dayOffset: -30,
  },
  {
    title: "Prepare program agenda & presentation slides",
    description: "Draft the run-of-show, activities, and any slides needed.",
    phase: "before",
    dayOffset: -21,
  },
  {
    title: "Confirm speakers/presenters",
    description: "Lock in and confirm availability with any speakers or presenters.",
    phase: "before",
    dayOffset: -21,
  },
  {
    title: "Prepare gifts/giveaways",
    description: "If applicable, source and prepare any gifts or giveaways.",
    phase: "before",
    dayOffset: -21,
  },
  {
    title: "Coordinate marketing & countdown emails",
    description: "Work with the marketing team on promotion and countdown emails to GAs.",
    phase: "before",
    dayOffset: -14,
  },
  {
    title: "Create volunteer list & name stickers",
    description: "Finalize the volunteer roster and prep name stickers for the day of.",
    phase: "before",
    dayOffset: -10,
  },
  {
    title: "Upload event to Engage",
    description: "Post the event on Engage with clear entry instructions.",
    phase: "before",
    dayOffset: -10,
  },
  {
    title: "Send entry-instructions email to students",
    description: "Email all students with clear instructions on how to enter the event.",
    phase: "before",
    dayOffset: -5,
  },

  // --- During ---
  {
    title: "Set up the venue",
    description: "Decoration, registration table, catering counter, and audio/visual all set up.",
    phase: "during",
    dayOffset: 0,
  },
  {
    title: "Confirm volunteers are present",
    description: "Check in all assigned volunteers before doors open.",
    phase: "during",
    dayOffset: 0,
  },
  {
    title: "Take attendance",
    description: "CORQ app for students; paper attendance for community members and staff/faculty.",
    phase: "during",
    dayOffset: 0,
  },
  {
    title: "Manage entry against room capacity",
    description: "Set an attendance limit based on room capacity and close entry once it's reached.",
    phase: "during",
    dayOffset: 0,
  },
  {
    title: "Handle leftover food",
    description: "Invite students via WhatsApp/email, or pack leftovers in ziplock bags.",
    phase: "during",
    dayOffset: 0,
  },
  {
    title: "Photograph the event",
    description: "Event photographer captures photos and video throughout.",
    phase: "during",
    dayOffset: 0,
  },

  // --- After ---
  {
    title: "Wind up the location",
    description: "Volunteers available to break down the venue on time.",
    phase: "after",
    dayOffset: 0,
  },
  {
    title: "Return items to ISO Stores",
    description: "Registration table, decoration, and AV items returned to their proper location.",
    phase: "after",
    dayOffset: 1,
  },
  {
    title: "Send thank-you email to volunteers",
    description: "Thank everyone who helped with the event.",
    phase: "after",
    dayOffset: 2,
  },
  {
    title: "Debrief: what went well / what to improve",
    description: "Capture notes for next time.",
    phase: "after",
    dayOffset: 2,
  },
  {
    title: "Share event photos/videos",
    description: "Photographer shares media with the ISO GA team and the GA WhatsApp group.",
    phase: "after",
    dayOffset: 2,
  },
  {
    title: "Get event reflection/blog",
    description: "Collect a written reflection or blog post about the event.",
    phase: "after",
    dayOffset: 3,
  },
  {
    title: "Submit event scribe reflection",
    description: "Scribe writes and submits the event reflection to Dr. Lord within 3 days of the event.",
    phase: "after",
    dayOffset: 3,
  },
];
