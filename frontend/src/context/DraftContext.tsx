import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getActiveDrafts, deleteDraftPlan, type DraftPlan } from "../lib/dataClient";

interface DraftContextValue {
  // One entry per event being planned — several can be in flight at once.
  drafts: DraftPlan[];
  loading: boolean;
  refreshDrafts: () => Promise<void>;
  discardDraft: (draftId: string) => Promise<void>;
}

const DraftContext = createContext<DraftContextValue | undefined>(undefined);

// Backed by Supabase (draft_plans/draft_tasks), not local React state —
// specifically so two Coordinators, on two different logins/devices,
// see and can act on the same in-flight AI-drafted plans. This is a thin
// cache: refreshDrafts() re-fetches from the DB, which callers do after
// every mutation (create/approve/discard/edit) rather than trusting
// optimistic local state, since someone else may have changed it too.
export function DraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<DraftPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshDrafts = async () => {
    try {
      setDrafts(await getActiveDrafts());
    } catch {
      // leave whatever was last known — a transient fetch failure
      // shouldn't wipe the nav badge / review page state
    }
  };

  useEffect(() => {
    refreshDrafts().finally(() => setLoading(false));
  }, []);

  const discardDraft = async (draftId: string) => {
    await deleteDraftPlan(draftId);
    await refreshDrafts();
  };

  return (
    <DraftContext.Provider value={{ drafts, loading, refreshDrafts, discardDraft }}>
      {children}
    </DraftContext.Provider>
  );
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used within a DraftProvider");
  return ctx;
}
