
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChartNoAxesColumnIncreasing,
  Clock3,
  Flame,
  Target,
  TrendingUp,
  CalendarDays,
  RefreshCw,
  BookOpen,
  Lightbulb,
  CircleCheck,
  Mic,
  Sparkles,
  Phone,
} from "lucide-react";
import {
  getPracticeSessions,
  getConversationReports,
  type PracticeHistorySession,
  type ConversationHistoryReport,
} from "../lib/progress";

type Activity = {
  id: string;
  type: "SpeakCheck" | "Before We Talk";
  createdAt: Date | null;
  durationSeconds: number;
  score: number | null;
  description: string;
};

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} min`;
  return `${safeSeconds} sec`;
}

function formatDate(date: Date | null): string {
  if (!date) return "Date unavailable";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getDayStart(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getStreak(activities: Activity[]): number {
  const practicedDays = new Set(
    activities
      .map((activity) => activity.createdAt)
      .filter((date): date is Date => date !== null)
      .map(dayKey),
  );

  const today = getDayStart(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let current: Date | null = practicedDays.has(dayKey(today))
    ? today
    : practicedDays.has(dayKey(yesterday))
      ? yesterday
      : null;

  if (!current) return 0;

  let streak = 0;

  while (current && practicedDays.has(dayKey(current))) {
    streak += 1;
    const previousDate: Date = new Date(current as Date);
    previousDate.setDate(previousDate.getDate() - 1);
    current = previousDate;
  }

  return streak;
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="min-w-0 rounded-[1.5rem] border border-white/80 bg-white/75 p-4 shadow-[0_12px_36px_rgba(30,100,65,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] sm:p-5">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
          <Icon size={19} />
        </span>
        <span>{label}</span>
      </div>

      <p className="mt-4 break-words text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </article>
  );
}

export default function Progress() {
  const [sessions, setSessions] = useState<PracticeHistorySession[]>([]);
  const [calls, setCalls] = useState<ConversationHistoryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProgress() {
    setLoading(true);
    setError("");

    try {
      const [practiceData, conversationData] = await Promise.all([
        getPracticeSessions(),
        getConversationReports(),
      ]);

      setSessions(practiceData);
      setCalls(conversationData);
    } catch (err) {
      console.error("Unable to load progress:", err);
      setError(
        "We couldn't load your progress. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProgress();
  }, []);

  const activities = useMemo<Activity[]>(() => {
    const practiceActivities: Activity[] = sessions.map((session) => ({
      id: `practice-${session.id}`,
      type: "SpeakCheck",
      createdAt: session.createdAt,
      durationSeconds: session.durationSeconds,
      score: session.averageMatch,
      description: `${session.checkedSentences} sentences`,
    }));

    const callActivities: Activity[] = calls.map((call) => ({
      id: `call-${call.id}`,
      type: "Before We Talk",
      createdAt: call.createdAt,
      durationSeconds: call.durationSeconds,
      score: call.overall,
      description: call.scenario || "Voice conversation",
    }));

    return [...practiceActivities, ...callActivities].sort(
      (a, b) =>
        (b.createdAt?.getTime() ?? 0) -
        (a.createdAt?.getTime() ?? 0),
    );
  }, [sessions, calls]);

  const stats = useMemo(() => {
    const totalSeconds = activities.reduce(
      (total, activity) => total + activity.durationSeconds,
      0,
    );

    return {
      totalActivities: activities.length,
      totalSeconds,
      streak: getStreak(activities),
    };
  }, [activities]);

  const speakCheckStats = useMemo(() => {
    const totalSentences = sessions.reduce(
      (total, session) => total + session.checkedSentences,
      0,
    );

    const averageAccuracy =
      sessions.length > 0
        ? Math.round(
            sessions.reduce(
              (total, session) => total + session.averageMatch,
              0,
            ) / sessions.length,
          )
        : 0;

    return {
      count: sessions.length,
      totalSentences,
      averageAccuracy,
    };
  }, [sessions]);

  const conversationStats = useMemo(() => {
    const scoredCalls = calls.filter(
      (call) => call.overall !== null && Number.isFinite(call.overall),
    );

    const averageScore =
      scoredCalls.length > 0
        ? Math.round(
            scoredCalls.reduce(
              (total, call) => total + (call.overall ?? 0),
              0,
            ) / scoredCalls.length,
          )
        : null;

    const totalSeconds = calls.reduce(
      (total, call) => total + call.durationSeconds,
      0,
    );

    return {
      count: calls.length,
      averageScore,
      totalSeconds,
    };
  }, [calls]);

  const weeklyActivity = useMemo(() => {
    const today = getDayStart(new Date());

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));

      const dayActivities = activities.filter(
        (activity) =>
          activity.createdAt &&
          dayKey(activity.createdAt) === dayKey(date),
      );

      return {
        key: dayKey(date),
        label: date.toLocaleDateString("en-IN", {
          weekday: "short",
        }),
        count: dayActivities.length,
        seconds: dayActivities.reduce(
          (total, activity) => total + activity.durationSeconds,
          0,
        ),
        isToday: dayKey(date) === dayKey(today),
      };
    });
  }, [activities]);

  const recentActivities = activities.slice(0, 5);

  const improvementTips = useMemo(() => {
    const tips: string[] = [];

    if (sessions.length === 0) {
      tips.push(
        "Complete a SpeakCheck session to receive personalized pronunciation and word accuracy feedback.",
      );
    } else if (speakCheckStats.averageAccuracy < 70) {
      tips.push(
        "Focus on clear pronunciation. Listen to each sentence and repeat it slowly before increasing your pace.",
      );
    } else if (speakCheckStats.averageAccuracy < 90) {
      tips.push(
        "You're building accuracy. Pay attention to missed or changed words and repeat those sentences.",
      );
    } else {
      tips.push(
        "Great SpeakCheck accuracy! Keep practising and gradually work on natural rhythm and confident delivery.",
      );
    }

    if (calls.length === 0) {
      tips.push(
        "Try a Before We Talk voice conversation to practise real-life speaking and interview confidence.",
      );
    } else if (
      conversationStats.averageScore !== null &&
      conversationStats.averageScore < 70
    ) {
      tips.push(
        "Review your call scores and focus on fluency, grammar, and clarity during your next conversation.",
      );
    } else if (conversationStats.averageScore !== null) {
      tips.push(
        "Keep building your conversation confidence. Try different scenarios and difficulty levels.",
      );
    }

    if (stats.streak === 0) {
      tips.push(
        "Start a new streak by completing a speaking activity today.",
      );
    } else if (stats.streak < 7) {
      tips.push(
        `You've practised on ${stats.streak} consecutive day${stats.streak === 1 ? "" : "s"}. Try to keep the routine going.`,
      );
    } else {
      tips.push(
        `Excellent consistency: ${stats.streak} consecutive practice days!`,
      );
    }

    return tips;
  }, [
    sessions.length,
    calls.length,
    speakCheckStats.averageAccuracy,
    conversationStats.averageScore,
    stats.streak,
  ]);

  const hasActivity = activities.length > 0;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#effaf4] px-4 pb-28 pt-6 text-slate-900 dark:bg-[#071b18] dark:text-white sm:px-8 sm:pb-32 sm:pt-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/65 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm backdrop-blur-xl transition hover:bg-white dark:border-emerald-300/15 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10"
        >
          <ArrowLeft size={17} />
          Back to Home
        </Link>

        <header className="mt-6 flex flex-wrap items-start justify-between gap-4 sm:mt-8">
          <div className="min-w-0">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
              <ChartNoAxesColumnIncreasing size={24} />
            </div>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/60 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 shadow-sm backdrop-blur-xl dark:border-emerald-300/15 dark:bg-white/5 dark:text-emerald-200">
              <Sparkles size={13} />
              TALKREADY AI
            </div>

            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Your Progress
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              Track your speaking practice, review your conversations,
              and discover where you can improve.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadProgress()}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white/75 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm backdrop-blur-xl transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-300/20 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-emerald-400/10"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {loading && (
          <section
            className="mt-8 rounded-[1.6rem] border border-white/80 bg-white/70 p-8 text-center shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05]"
            aria-live="polite"
          >
            <RefreshCw
              size={25}
              className="mx-auto animate-spin text-emerald-600 dark:text-emerald-300"
            />
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Loading your speaking progress…
            </p>
          </section>
        )}

        {!loading && error && (
          <section
            className="mt-8 rounded-[1.6rem] border border-rose-200 bg-rose-50/80 p-5 backdrop-blur-xl dark:border-rose-300/20 dark:bg-rose-400/[0.08]"
            role="alert"
          >
            <p className="font-bold text-rose-800 dark:text-rose-200">
              Unable to load progress
            </p>
            <p className="mt-2 text-sm leading-6 text-rose-700 dark:text-rose-200/80">
              {error}
            </p>
            <button
              type="button"
              onClick={() => void loadProgress()}
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Try again
            </button>
          </section>
        )}

        {!loading && !error && !hasActivity && (
          <section className="mt-8 rounded-[1.8rem] border border-white/80 bg-white/70 p-6 text-center shadow-[0_16px_48px_rgba(30,100,65,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
              <Mic size={30} />
            </div>

            <h2 className="mt-5 text-xl font-extrabold">
              Your progress starts here
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
              Complete a SpeakCheck session or a Before We Talk
              conversation to see your speaking progress here.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/speakcheck"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(5,150,105,0.22)] transition hover:bg-emerald-700"
              >
                Start SpeakCheck
                <TrendingUp size={17} />
              </Link>

              <Link
                to="/before-we-talk"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-5 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-300/20 dark:bg-white/5 dark:text-emerald-200"
              >
                Before We Talk
                <Phone size={17} />
              </Link>
            </div>
          </section>
        )}

        {!loading && !error && hasActivity && (
          <>
            <section
              className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
              aria-label="Combined activity statistics"
            >
              <StatCard
                icon={CircleCheck}
                label="Total activities"
                value={String(stats.totalActivities)}
                description="SpeakCheck sessions and calls"
              />
              <StatCard
                icon={Clock3}
                label="Speaking time"
                value={formatDuration(stats.totalSeconds)}
                description="Combined speaking time"
              />
              <StatCard
                icon={Flame}
                label="Practice streak"
                value={`${stats.streak} ${stats.streak === 1 ? "day" : "days"}`}
                description="Consecutive days with activity"
              />
              <StatCard
                icon={CalendarDays}
                label="This week"
                value={String(
                  weeklyActivity.reduce(
                    (total, day) => total + day.count,
                    0,
                  ),
                )}
                description="Activities in the last 7 days"
              />
            </section>

            <section className="mt-8">
              <div className="mb-4">
                <h2 className="text-xl font-extrabold">
                  Activity breakdown
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Your two learning activities are tracked separately.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-[1.6rem] border border-white/80 bg-white/75 p-5 shadow-[0_12px_36px_rgba(30,100,65,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
                      <BookOpen size={21} />
                    </div>
                    <div>
                      <h3 className="font-extrabold">SpeakCheck</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Sentence speaking practice
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Sessions
                      </p>
                      <p className="mt-1 text-2xl font-extrabold">
                        {speakCheckStats.count}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Average match
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        {speakCheckStats.averageAccuracy}%
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Sentences checked
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        {speakCheckStats.totalSentences}
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[1.6rem] border border-white/80 bg-white/75 p-5 shadow-[0_12px_36px_rgba(30,100,65,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">
                      <Phone size={21} />
                    </div>
                    <div>
                      <h3 className="font-extrabold">Before We Talk</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Live AI voice conversations
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Completed calls
                      </p>
                      <p className="mt-1 text-2xl font-extrabold">
                        {conversationStats.count}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Average call score
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-sky-600 dark:text-sky-400">
                        {conversationStats.averageScore === null
                          ? "—"
                          : `${conversationStats.averageScore}%`}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Total call duration
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        {formatDuration(conversationStats.totalSeconds)}
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <article className="rounded-[1.6rem] border border-white/80 bg-white/70 p-5 shadow-[0_12px_36px_rgba(30,100,65,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <h2 className="font-extrabold">Weekly activity</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Your last 7 calendar days
                    </p>
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-7 gap-2">
                  {weeklyActivity.map((day) => {
                    const maxCount = Math.max(
                      1,
                      ...weeklyActivity.map((item) => item.count),
                    );
                    const height =
                      day.count === 0
                        ? 8
                        : Math.max(16, (day.count / maxCount) * 100);

                    return (
                      <div
                        key={day.key}
                        className="flex min-w-0 flex-col items-center gap-2"
                        title={`${day.count} activities · ${formatDuration(day.seconds)}`}
                      >
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {day.count}
                        </span>
                        <div className="flex h-28 w-full items-end justify-center">
                          <div
                            className={`w-full max-w-8 rounded-t-lg transition-all ${
                              day.count > 0
                                ? "bg-emerald-500"
                                : "bg-slate-100 dark:bg-white/10"
                            }`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span
                          className={`text-[11px] ${
                            day.isToday
                              ? "font-extrabold text-emerald-700 dark:text-emerald-200"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
                  {weeklyActivity.reduce(
                    (total, day) => total + day.count,
                    0,
                  )}{" "}
                  activities this week
                </p>
              </article>

              <article className="rounded-[1.6rem] border border-white/80 bg-white/70 p-5 shadow-[0_12px_36px_rgba(30,100,65,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-200">
                    <Lightbulb size={20} />
                  </div>
                  <div>
                    <h2 className="font-extrabold">Areas to improve</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Suggestions from your saved scores
                    </p>
                  </div>
                </div>

                <ul className="mt-5 space-y-4">
                  {improvementTips.map((tip, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
                    >
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-extrabold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
                        {index + 1}
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </section>

            <section className="mt-6 rounded-[1.6rem] border border-white/80 bg-white/70 p-5 shadow-[0_12px_36px_rgba(30,100,65,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold">
                    Recent activity
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Your latest SpeakCheck sessions and calls
                  </p>
                </div>

                <Link
                  to="/practice-history"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 hover:text-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-400/10"
                >
                  View all history
                  <ArrowLeft className="rotate-180" size={15} />
                </Link>
              </div>

              <div className="mt-5 divide-y divide-emerald-100/80 dark:divide-white/10">
                {recentActivities.map((activity) => (
                  <article
                    key={activity.id}
                    className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          activity.type === "SpeakCheck"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200"
                            : "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200"
                        }`}
                      >
                        {activity.type === "SpeakCheck" ? (
                          <BookOpen size={19} />
                        ) : (
                          <Phone size={19} />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {activity.type === "SpeakCheck"
                            ? "SpeakCheck session"
                            : "Before We Talk call"}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(activity.createdAt)} ·{" "}
                          {activity.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={`text-lg font-extrabold ${
                          activity.score === null
                            ? "text-slate-500"
                            : activity.score >= 80
                              ? "text-emerald-600 dark:text-emerald-400"
                              : activity.score >= 60
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {activity.score === null
                          ? "—"
                          : `${Math.round(activity.score)}%`}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDuration(activity.durationSeconds)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <p className="mt-5 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
              Your dashboard combines saved SpeakCheck sessions and
              Before We Talk call reports. Their performance scores
              are calculated separately.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
