import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getActiveDraft, deleteDraftPlan, type DraftPlan } from "../lib/dataClient";

interface DraftContextValue {
  pendingDraft: DraftPlan | null;
  loading: boolean;
  refreshDraft: () => Promise<void>;
  discardDraft: () => Promise<void>;
}

const DraftContext = createContext<DraftContextValue | undefined>(undefined);

// Backed by Supabase (draft_plans/draft_tasks), not local React state —
// specifically so two Coordinators, on two different logins/devices,
// see and can act on the same in-flight AI-drafted plan. This is a thin
// cache: refreshDraft() re-fetches from the DB, which callers do after
// every mutation (create/approve/discard/edit) rather than trusting
// optimistic local state, since someone else may have changed it too.
export function DraftProvider({ children }: { children: ReactNode }) {
  const [pendingDraft, setPendingDraft] = useState<DraftPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshDraft = async () => {
    try {
      const draft = await getActiveDraft();
      setPendingDraft(draft);
    } catch {
      // leave whatever was last known — a transient fetch failure
      // shouldn't wipe the nav badge / review page state
    }
  };

  useEffect(() => {
    refreshDraft().finally(() => setLoading(false));
  }, []);

  const discardDraft = async () => {
    if (!pendingDraft) return;
    await deleteDraftPlan(pendingDraft.draftId);
    await refreshDraft();
  };

  return (
    <DraftContext.Provider value={{ pendingDraft, loading, refreshDraft, discardDraft }}>
      {children}
    </DraftContext.Provider>
  );
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used within a DraftProvider");
  return ctx;
}
