import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  RefreshCw,
  Sparkles,
  Phone,
  Target,
  ChevronDown,
  ChevronUp,
  Mic,
  Trash2,
} from "lucide-react";
import {
  getPracticeSessions,
  getConversationReports,
  clearAllPracticeHistory,
  type PracticeHistorySession,
  type ConversationHistoryReport,
} from "../lib/progress";

type HistoryFilter = "all" | "speakcheck" | "conversation";

type Activity = {
  id: string;
  type: "speakcheck" | "conversation";
  createdAt: Date | null;
  durationSeconds: number;
  score: number | null;
  session?: PracticeHistorySession;
  call?: ConversationHistoryReport;
};

export default function PracticeHistory() {
  const [sessions, setSessions] = useState<PracticeHistorySession[]>([]);
  const [calls, setCalls] = useState<ConversationHistoryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearError, setClearError] = useState("");

  async function loadHistory() {
    setLoading(true);
    setError("");

    try {
      const [practiceHistory, conversationHistory] = await Promise.all([
        getPracticeSessions(),
        getConversationReports(),
      ]);

      setSessions(practiceHistory);
      setCalls(conversationHistory);
    } catch (err) {
      console.error("Failed to load practice history:", err);
      setError("Unable to load your practice history. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClearHistory() {
    setClearingHistory(true);
    setClearError("");

    try {
      await clearAllPracticeHistory();

      setSessions([]);
      setCalls([]);
      setExpandedCall(null);
      setFilter("all");
      setShowClearConfirm(false);
    } catch (err) {
      console.error("Failed to clear practice history:", err);
      setClearError("Unable to clear history. Please try again.");
    } finally {
      setClearingHistory(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  const activities = useMemo<Activity[]>(() => {
    const practiceActivities: Activity[] = sessions.map((session) => ({
      id: `practice-${session.id}`,
      type: "speakcheck",
      createdAt: session.createdAt,
      durationSeconds: session.durationSeconds,
      score: session.averageMatch,
      session,
    }));

    const callActivities: Activity[] = calls.map((call) => ({
      id: `call-${call.id}`,
      type: "conversation",
      createdAt: call.createdAt,
      durationSeconds: call.durationSeconds,
      score: call.overall,
      call,
    }));

    return [...practiceActivities, ...callActivities].sort(
      (a, b) =>
        (b.createdAt?.getTime() ?? 0) -
        (a.createdAt?.getTime() ?? 0),
    );
  }, [sessions, calls]);

  const filteredActivities = activities.filter((activity) => {
    if (filter === "speakcheck") return activity.type === "speakcheck";
    if (filter === "conversation") return activity.type === "conversation";
    return true;
  });

  const totalSeconds = activities.reduce(
    (total, activity) => total + activity.durationSeconds,
    0,
  );

  const speakCheckAverage =
    sessions.length > 0
      ? Math.round(
          sessions.reduce(
            (total, session) => total + session.averageMatch,
            0,
          ) / sessions.length,
        )
      : null;

  const scoredCalls = calls.filter(
    (call) => call.overall !== null && Number.isFinite(call.overall),
  );

  const callAverage =
    scoredCalls.length > 0
      ? Math.round(
          scoredCalls.reduce(
            (total, call) => total + (call.overall ?? 0),
            0,
          ) / scoredCalls.length,
        )
      : null;

  function formatDuration(seconds: number) {
    const safeSeconds = Math.max(0, Math.round(seconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0 && remainingSeconds > 0) {
      return `${minutes} min ${remainingSeconds} sec`;
    }
    if (minutes > 0) return `${minutes} min`;
    return `${remainingSeconds} sec`;
  }

  function formatDate(date: Date | null) {
    if (!date) return "Date unavailable";

    try {
      return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    } catch {
      return "Date unavailable";
    }
  }

  function scoreColor(score: number | null) {
    if (score === null) return "text-slate-500 dark:text-slate-400";
    if (score >= 80) return "text-emerald-700 dark:text-emerald-300";
    if (score >= 60) return "text-amber-600 dark:text-amber-300";
    return "text-rose-600 dark:text-rose-300";
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#effaf4] px-4 pb-28 pt-6 text-slate-900 dark:bg-[#071b18] dark:text-white sm:px-6 sm:pb-32 sm:pt-10">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/65 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm backdrop-blur-xl transition hover:bg-white dark:border-emerald-300/15 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10"
        >
          <ArrowLeft size={17} />
          Back to Home
        </Link>

        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/60 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 shadow-sm backdrop-blur-xl dark:border-emerald-300/15 dark:bg-white/5 dark:text-emerald-200">
            <Sparkles size={14} />
            TALKREADY AI
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Practice History
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            Review your completed speaking sessions and AI voice
            conversations in one place.
          </p>
        </header>

        {/* Combined statistics */}
        <section
          aria-label="Overall activity statistics"
          className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <article className="rounded-[1.6rem] border border-white/80 bg-white/75 p-5 shadow-[0_12px_36px_rgba(30,100,65,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Total activities
              </p>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
                <BookOpen size={19} />
              </span>
            </div>
            <p className="mt-4 text-3xl font-extrabold tracking-tight tabular-nums">
              {activities.length}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              SpeakCheck sessions and completed calls
            </p>
          </article>

          <article className="rounded-[1.6rem] border border-white/80 bg-white/75 p-5 shadow-[0_12px_36px_rgba(30,100,65,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Total speaking time
              </p>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-200">
                <Clock3 size={19} />
              </span>
            </div>
            <p className="mt-4 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
              {formatDuration(totalSeconds)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Combined speaking time
            </p>
          </article>

          <article className="rounded-[1.6rem] border border-white/80 bg-white/75 p-5 shadow-[0_12px_36px_rgba(30,100,65,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Before We Talk
              </p>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">
                <Phone size={19} />
              </span>
            </div>
            <p className="mt-4 text-3xl font-extrabold tracking-tight tabular-nums">
              {calls.length}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Completed voice calls
            </p>
            {callAverage !== null && (
              <p className="mt-2 text-sm font-semibold text-sky-700 dark:text-sky-200">
                Average score: {callAverage}%
              </p>
            )}
          </article>
        </section>

        {/* Separate activity averages */}
        {activities.length > 0 && (
          <section className="mb-8 grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-300/10 dark:bg-emerald-400/[0.06]">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                SpeakCheck average match
              </p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700 dark:text-emerald-200">
                {speakCheckAverage === null ? "—" : `${speakCheckAverage}%`}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {sessions.length} practice sessions
              </p>
            </article>

            <article className="rounded-2xl border border-sky-200/70 bg-sky-50/70 p-4 dark:border-sky-300/10 dark:bg-sky-400/[0.06]">
              <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">
                Before We Talk average score
              </p>
              <p className="mt-1 text-2xl font-extrabold text-sky-700 dark:text-sky-200">
                {callAverage === null ? "—" : `${callAverage}%`}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {calls.length} completed calls
              </p>
            </article>
          </section>
        )}

        {/* Activity list */}
        <section className="rounded-[1.8rem] border border-white/80 bg-white/70 p-4 shadow-[0_16px_48px_rgba(30,100,65,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055] sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Your activity
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Browse your saved practice sessions and call reports.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => void loadHistory()}
                disabled={loading || clearingHistory}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white/75 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm backdrop-blur-xl transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-300/20 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-emerald-400/10"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                {loading ? "Refreshing…" : "Refresh"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setClearError("");
                  setShowClearConfirm(true);
                }}
                disabled={
                  loading || clearingHistory || activities.length === 0
                }
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50/80 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-300/20 dark:bg-rose-400/[0.08] dark:text-rose-200 dark:hover:bg-rose-400/15"
              >
                <Trash2 size={16} />
                Clear History
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setFilter("all")}
              aria-pressed={filter === "all"}
              className={`min-h-10 rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${
                filter === "all"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "border border-emerald-100 bg-white/70 text-slate-600 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              }`}
            >
              All Activity ({activities.length})
            </button>

            <button
              type="button"
              onClick={() => setFilter("speakcheck")}
              aria-pressed={filter === "speakcheck"}
              className={`min-h-10 rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${
                filter === "speakcheck"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "border border-emerald-100 bg-white/70 text-slate-600 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              }`}
            >
              SpeakCheck ({sessions.length})
            </button>

            <button
              type="button"
              onClick={() => setFilter("conversation")}
              aria-pressed={filter === "conversation"}
              className={`min-h-10 rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${
                filter === "conversation"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "border border-emerald-100 bg-white/70 text-slate-600 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              }`}
            >
              Before We Talk ({calls.length})
            </button>
          </div>

          {/* Clear history confirmation */}
          {showClearConfirm && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/80 p-5 dark:border-rose-300/20 dark:bg-rose-400/[0.08]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300">
                  <Trash2 size={19} />
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-rose-800 dark:text-rose-200">
                    Clear all practice history?
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    This will permanently delete all SpeakCheck sessions and
                    Before We Talk reports. Your profile and learning
                    preferences will not be affected.
                  </p>

                  {clearError && (
                    <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-300">
                      {clearError}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleClearHistory()}
                      disabled={clearingHistory}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                      {clearingHistory ? "Clearing…" : "Yes, clear history"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowClearConfirm(false);
                        setClearError("");
                      }}
                      disabled={clearingHistory}
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
                <RefreshCw size={21} className="animate-spin" />
              </span>
              <p className="font-medium text-slate-700 dark:text-slate-200">
                Loading your activity…
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Your saved sessions and call reports will appear here.
              </p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-8 text-center dark:border-rose-300/20 dark:bg-rose-400/10">
              <p className="text-sm leading-6 text-rose-700 dark:text-rose-200">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void loadHistory()}
                className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Try again
              </button>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-5 py-12 text-center dark:border-emerald-300/20 dark:bg-emerald-400/[0.06]">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-emerald-700 shadow-sm dark:bg-white/10 dark:text-emerald-200">
                {filter === "conversation" ? (
                  <Phone size={26} />
                ) : (
                  <BookOpen size={26} />
                )}
              </span>

              <h3 className="text-lg font-bold">
                {filter === "all"
                  ? "No saved activity yet"
                  : filter === "speakcheck"
                    ? "No SpeakCheck sessions yet"
                    : "No call reports yet"}
              </h3>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
                {filter === "conversation"
                  ? "Complete a Before We Talk voice conversation to see its report here."
                  : "Complete a speaking practice session to see your history and review your results here."}
              </p>

              <Link
                to={
                  filter === "conversation"
                    ? "/before-we-talk"
                    : "/speakcheck"
                }
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(5,150,105,0.22)] transition hover:bg-emerald-700"
              >
                {filter === "conversation" ? (
                  <>
                    <Phone size={17} />
                    Start a conversation
                  </>
                ) : (
                  <>
                    <BookOpen size={17} />
                    Start SpeakCheck
                  </>
                )}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActivities.map((activity) => {
                if (activity.type === "speakcheck" && activity.session) {
                  const session = activity.session;

                  return (
                    <article
                      key={activity.id}
                      className="rounded-[1.4rem] border border-emerald-100/90 bg-white/65 p-4 shadow-sm backdrop-blur-xl transition hover:border-emerald-200 hover:shadow-md dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-emerald-300/20 sm:p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
                              <BookOpen size={17} />
                            </span>
                            <h3 className="text-base font-bold sm:text-lg">
                              SpeakCheck Practice
                            </h3>
                          </div>

                          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            {formatDate(session.createdAt)}
                          </p>

                          <p className="mt-3 inline-flex items-center rounded-full bg-slate-100/80 px-3 py-1.5 text-sm text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                            {session.checkedSentences} sentence
                            {session.checkedSentences === 1 ? "" : "s"} practiced
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:min-w-52">
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3 dark:border-emerald-300/10 dark:bg-emerald-400/[0.08]">
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                              Average match
                            </p>
                            <p className="mt-1 text-2xl font-extrabold text-emerald-700 dark:text-emerald-200">
                              {Math.round(session.averageMatch)}%
                            </p>
                          </div>

                          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                            <p className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <Clock3 size={13} />
                              Duration
                            </p>
                            <p className="mt-2 text-sm font-extrabold">
                              {formatDuration(session.durationSeconds)}
                            </p>
                          </div>

                          <p className="col-span-2 text-right text-xs text-slate-500 dark:text-slate-400">
                            Pace:{" "}
                            <span className="font-semibold capitalize text-slate-700 dark:text-slate-200">
                              {session.selectedSpeed}
                            </span>
                          </p>
                        </div>
                      </div>

                      {session.results.length > 0 && (
                        <details className="mt-5 border-t border-emerald-100 pt-4 dark:border-white/10">
                          <summary className="cursor-pointer list-none text-sm font-bold text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-200 dark:hover:text-emerald-100">
                            <span className="inline-flex items-center gap-2">
                              <BookOpen size={15} />
                              View sentence results ({session.results.length})
                            </span>
                          </summary>

                          <div className="mt-4 space-y-3">
                            {session.results.map((result, index) => (
                              <div
                                key={`${session.id}-sentence-${index}`}
                                className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.035] sm:p-4"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <p className="text-sm font-medium leading-6">
                                    {result.sentence || `Sentence ${index + 1}`}
                                  </p>

                                  <span className="shrink-0 self-start rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-bold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
                                    {Math.round(result.match)}%
                                  </span>
                                </div>

                                {result.transcript && (
                                  <p className="mt-3 break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                      Your speech:
                                    </span>{" "}
                                    {result.transcript}
                                  </p>
                                )}

                                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                  <Clock3 size={13} />
                                  Speaking time:{" "}
                                  {formatDuration(result.speakingSeconds)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </article>
                  );
                }

                if (activity.type === "conversation" && activity.call) {
                  const call = activity.call;
                  const isExpanded = expandedCall === call.id;

                  return (
                    <article
                      key={activity.id}
                      className="rounded-[1.4rem] border border-sky-100/90 bg-white/65 p-4 shadow-sm backdrop-blur-xl transition hover:border-sky-200 hover:shadow-md dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-sky-300/20 sm:p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">
                              <Phone size={17} />
                            </span>
                            <h3 className="text-base font-bold sm:text-lg">
                              Before We Talk
                            </h3>
                          </div>

                          <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {call.scenario || "Voice conversation"}
                          </p>

                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {formatDate(call.createdAt)}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100/80 px-3 py-1.5 text-xs text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                              {call.difficulty}
                            </span>
                            <span className="rounded-full bg-slate-100/80 px-3 py-1.5 text-xs text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                              Voice: {call.voice}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:min-w-52">
                          <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-3 dark:border-sky-300/10 dark:bg-sky-400/[0.08]">
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                              Overall score
                            </p>
                            <p
                              className={`mt-1 text-2xl font-extrabold ${scoreColor(call.overall)}`}
                            >
                              {call.overall === null
                                ? "—"
                                : `${Math.round(call.overall)}%`}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                            <p className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <Clock3 size={13} />
                              Duration
                            </p>
                            <p className="mt-2 text-sm font-extrabold">
                              {formatDuration(call.durationSeconds)}
                            </p>
                          </div>

                          <p className="col-span-2 text-right text-xs text-slate-500 dark:text-slate-400">
                            {call.words} words · {call.uniqueWords} unique
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCall(isExpanded ? null : call.id)
                        }
                        aria-expanded={isExpanded}
                        className="mt-5 flex w-full items-center justify-between border-t border-sky-100 pt-4 text-sm font-bold text-sky-700 transition hover:text-sky-900 dark:border-white/10 dark:text-sky-200 dark:hover:text-sky-100"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Target size={16} />
                          {isExpanded ? "Hide call report" : "View call report"}
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-4 space-y-4">
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[
                              { label: "Fluency", value: call.fluency },
                              { label: "Grammar", value: call.grammar },
                              { label: "Vocabulary", value: call.vocabulary },
                              { label: "Clarity", value: call.clarity },
                            ].map((metric) => (
                              <div
                                key={metric.label}
                                className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 dark:border-sky-300/10 dark:bg-sky-400/[0.06]"
                              >
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {metric.label}
                                </p>
                                <p className="mt-1 text-xl font-extrabold text-sky-700 dark:text-sky-200">
                                  {Math.round(metric.value)}%
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Total words
                              </p>
                              <p className="mt-1 text-xl font-extrabold">
                                {call.words}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Unique words
                              </p>
                              <p className="mt-1 text-xl font-extrabold">
                                {call.uniqueWords}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Fillers
                              </p>
                              <p className="mt-1 text-xl font-extrabold">
                                {call.fillers}
                              </p>
                            </div>
                          </div>

                          <p className="flex items-center gap-2 rounded-xl bg-slate-50/80 p-3 text-xs leading-5 text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                            <Mic size={15} className="shrink-0" />
                            This report contains call metrics only. Audio and
                            conversation transcripts are not included.
                          </p>
                        </div>
                      )}
                    </article>
                  );
                }

                return null;
              })}
            </div>
          )}
        </section>

        <p className="mx-auto mt-6 max-w-2xl px-2 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
          Keep practising consistently. Small improvements in clarity,
          fluency, and pace add up over time.
        </p>
      </div>
    </main>
  );
}