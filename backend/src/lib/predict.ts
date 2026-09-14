import { supabase } from './supabase';

// Server-side prediction logic for the AI chat's lookup_event_history
// tool. Deliberately NOT a fitted/ML model — with only ~3 historical
// data points per event, anything fancier would be fitting noise, not
// a real pattern. Instead: recency-weighted averages, variance-aware
// confidence, and a category fallback, all directly justified by what
// was actually found in this data (see conversation notes, Aug 2026).

export interface EventPrediction {
  matchedEventCount: number;
  predictedAttendance: number | null;
  attendanceRange: { low: number; high: number } | null;
  confidence: 'high' | 'medium' | 'low';
  recommendedFoodCount: number | null;
  basisNote: string;
}

const IGNORED_QUERY_WORDS = new Set([
  'the', 'a', 'an', 'next', 'event', 'celebration', 'festival', 'for', 'on', 'in', 'this',
]);

// Food order policy: sustainability/efficiency-first (order close to
// predicted attendance, don't just replicate a historically wasteful
// ratio) but never recommend below a floor that risks the event running
// short. Per team direction: efficiency matters, but events must not
// be affected by running out.
const FOOD_SAFETY_FLOOR_RATIO = 1.05; // never less than 5% buffer over predicted attendance
const FOOD_WASTE_CEILING_RATIO = 1.1; // never more than 10% buffer, even if history over-ordered more

const CONFIDENCE_HIGH_CV_MAX = 0.12; // coefficient of variation (stdDev/mean) thresholds
const CONFIDENCE_MEDIUM_CV_MAX = 0.3;

type EventRow = { event_id: string; date: string; actual_attendance: number | null };

// Weights later entries (assumes ascending date order) more heavily —
// simple linear recency weighting, robust with as few as 2-3 points
// unlike a fitted trend line, which would be noisy at this sample size.
function weightedAverage(valuesOldestFirst: number[]): number {
  const n = valuesOldestFirst.length;
  const weights = valuesOldestFirst.map((_, i) => i + 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  return valuesOldestFirst.reduce((sum, v, i) => sum + v * weights[i], 0) / weightSum;
}

function stdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function classifyConfidence(matchCount: number, coefficientOfVariation: number): 'high' | 'medium' | 'low' {
  if (matchCount >= 3 && coefficientOfVariation <= CONFIDENCE_HIGH_CV_MAX) return 'high';
  if (matchCount >= 2 && coefficientOfVariation <= CONFIDENCE_MEDIUM_CV_MAX) return 'medium';
  return 'low';
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Typo tolerance: "Wordlfest" should still find "Worldfest" rather than
// silently falling back to a generic category average. Only used when
// the exact/keyword match finds nothing — never overrides a real match,
// and the threshold (verified against realistic typos, e.g.
// "Navrati"->"Navratri" distance 1, "Mid autum festival" distance 2)
// is tight enough that genuinely different events (e.g. "Holi" vs
// "Worldfest", distance 7) never get conflated.
async function findFuzzyTitleMatch(query: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('events')
    .select('title')
    .eq('status', 'completed')
    .not('actual_attendance', 'is', null);
  if (error || !data) return null;

  const distinctTitles = Array.from(new Set(data.map((e) => e.title)));
  const normalizedQuery = query.toLowerCase();
  let best: { title: string; distance: number } | null = null;
  for (const title of distinctTitles) {
    const distance = levenshtein(normalizedQuery, title.toLowerCase());
    const threshold = Math.max(2, Math.floor(title.length * 0.3));
    if (distance <= threshold && (!best || distance < best.distance)) {
      best = { title, distance };
    }
  }
  return best?.title ?? null;
}

export async function predictEvent(eventName: string, category?: string | null): Promise<EventPrediction> {
  const keywords = eventName
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !IGNORED_QUERY_WORDS.has(w.toLowerCase()));

  let matched: EventRow[] = [];
  if (keywords.length > 0) {
    const orFilter = keywords.map((w) => `title.ilike.%${w}%`).join(',');
    const { data, error } = await supabase
      .from('events')
      .select('event_id, date, actual_attendance')
      .eq('status', 'completed')
      .not('actual_attendance', 'is', null)
      .or(orFilter)
      .order('date', { ascending: true }); // oldest-first for recency weighting
    if (error) throw error;
    matched = data ?? [];
  }

  let correctedTitle: string | null = null;
  if (matched.length === 0) {
    correctedTitle = await findFuzzyTitleMatch(eventName.trim());
    if (correctedTitle) {
      const { data, error } = await supabase
        .from('events')
        .select('event_id, date, actual_attendance')
        .eq('status', 'completed')
        .not('actual_attendance', 'is', null)
        .eq('title', correctedTitle)
        .order('date', { ascending: true });
      if (error) throw error;
      matched = data ?? [];
      if (matched.length === 0) correctedTitle = null;
    }
  }

  let usedCategoryFallback = false;
  if (matched.length === 0 && category) {
    const { data, error } = await supabase
      .from('events')
      .select('event_id, date, actual_attendance')
      .eq('status', 'completed')
      .not('actual_attendance', 'is', null)
      .eq('cultural_calendar_tag', category)
      .order('date', { ascending: true });
    if (error) throw error;
    if (data && data.length > 0) {
      matched = data;
      usedCategoryFallback = true;
    }
  }

  let basisNote: string;
  let confidence: 'high' | 'medium' | 'low';

  if (matched.length === 0) {
    const { data: all, error: allErr } = await supabase
      .from('events')
      .select('event_id, date, actual_attendance')
      .eq('status', 'completed')
      .not('actual_attendance', 'is', null)
      .order('date', { ascending: true });
    if (allErr) throw allErr;
    matched = all ?? [];
    confidence = 'low';
    basisNote = matched.length
      ? `No history for "${eventName.trim()}"${category ? ` or the "${category}" category` : ''} — rough estimate averaged across all ${matched.length} past completed events.`
      : 'No historical event data yet, so this is a placeholder estimate.';
  } else {
    const attendances = matched
      .map((e) => e.actual_attendance)
      .filter((n): n is number => typeof n === 'number');
    const plainMean = attendances.length ? attendances.reduce((a, b) => a + b, 0) / attendances.length : 0;
    const cv = plainMean > 0 ? stdDev(attendances, plainMean) / plainMean : 0;
    confidence = classifyConfidence(matched.length, cv);
    basisNote = usedCategoryFallback
      ? `No history for "${eventName.trim()}" specifically — estimate based on ${matched.length} past "${category}" events, weighted toward the most recent.`
      : correctedTitle
        ? `Interpreted "${eventName.trim()}" as "${correctedTitle}" — based on ${matched.length} past event${matched.length === 1 ? '' : 's'}, weighted toward the most recent.`
        : `Based on ${matched.length} past event${matched.length === 1 ? '' : 's'} matching "${eventName.trim()}"${matched.length >= 2 ? ', weighted toward the most recent' : ''}.`;
  }

  const attendances = matched
    .map((e) => e.actual_attendance)
    .filter((n): n is number => typeof n === 'number');

  let predictedAttendance: number | null = null;
  let attendanceRange: { low: number; high: number } | null = null;
  if (attendances.length > 0) {
    predictedAttendance = Math.round(weightedAverage(attendances));
    const plainMean = attendances.reduce((a, b) => a + b, 0) / attendances.length;
    const sd = stdDev(attendances, plainMean);
    attendanceRange = {
      low: Math.max(0, Math.round(predictedAttendance - sd)),
      high: Math.round(predictedAttendance + sd),
    };
  }

  let recommendedFoodCount: number | null = null;
  if (predictedAttendance !== null) {
    if (matched.length > 0) {
      const eventIds = matched.map((e) => e.event_id);
      const { data: foodRows, error: foodErr } = await supabase
        .from('food_logs')
        .select('event_id, headcount_given, actual_attendance')
        .in('event_id', eventIds);
      if (foodErr) throw foodErr;

      const orderIndex = new Map(matched.map((e, i) => [e.event_id, i]));
      const ratiosOldestFirst = (foodRows ?? [])
        .filter((r) => r.actual_attendance > 0)
        .sort((a, b) => (orderIndex.get(a.event_id) ?? 0) - (orderIndex.get(b.event_id) ?? 0))
        .map((r) => r.headcount_given / r.actual_attendance);

      const rawRatio = ratiosOldestFirst.length ? weightedAverage(ratiosOldestFirst) : FOOD_SAFETY_FLOOR_RATIO;
      const targetRatio = Math.min(FOOD_WASTE_CEILING_RATIO, Math.max(FOOD_SAFETY_FLOOR_RATIO, rawRatio));
      recommendedFoodCount = Math.round(predictedAttendance * targetRatio);
    } else {
      recommendedFoodCount = Math.round(predictedAttendance * FOOD_SAFETY_FLOOR_RATIO);
    }
  }

  return {
    matchedEventCount: matched.length,
    predictedAttendance,
    attendanceRange,
    confidence: predictedAttendance === null ? 'low' : confidence,
    recommendedFoodCount,
    basisNote,
  };
}
