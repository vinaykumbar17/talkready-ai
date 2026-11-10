import { useEffect, useState, type ReactNode } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  AudioLines,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Mic,
  Moon,
  Sparkles,
  Sun,
  LogOut,
  LoaderCircle,
  Flame,
  Award,
  Target,
  BookOpen,
  Clock3,
  TrendingUp,
  CalendarCheck,
  ChevronRight,
  UserRound,
  Mail,
  ShieldCheck,
  Settings2,
  Globe2,
  ExternalLink,
} from "lucide-react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, db } from "./lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getPracticeSessions, type PracticeHistorySession } from "./lib/progress";
import SpeakCheck from "./routes/SpeakCheck";
import Auth from "./routes/Auth";
import PracticeHistory from "./routes/PracticeHistory";
import Progress from "./routes/Progress";
import BeforeWeTalk from "./routes/BeforeWeTalk";
import BottomNavigation from "./components/BottomNavigation";

type ThemePreference = "system" | "light" | "dark";
type ActiveTheme = "light" | "dark";

function getSystemTheme(): ActiveTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function useAppTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem("talkready-theme");
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved;
      }
    } catch {
      // Use the system theme if browser storage is unavailable.
    }
    return "system";
  });

  const [systemTheme, setSystemTheme] = useState<ActiveTheme>(getSystemTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const activeTheme = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
    document.documentElement.style.colorScheme = activeTheme;
    try {
      localStorage.setItem("talkready-theme", preference);
    } catch {
      // Theme switching still works without persistent storage.
    }
  }, [activeTheme, preference]);

  return { activeTheme, preference, setPreference };
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eff8f3] text-slate-900 dark:bg-[#101b19] dark:text-white">
      <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 px-5 py-4 text-sm font-medium shadow-lg shadow-emerald-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
        <LoaderCircle className="animate-spin text-emerald-700 dark:text-emerald-300" size={22} />
        Checking your session...
      </div>
    </main>
  );
}

function ProtectedRoute({
  user,
  loading,
  children,
}: {
  user: User | null;
  loading: boolean;
  children: ReactNode;
}) {
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function AndroidBackButtonHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let listener: { remove: () => Promise<void> } | undefined;

    const registerListener = async () => {
      const handle = await CapacitorApp.addListener("backButton", () => {
        // Before We Talk manages its own setup/call/report state.
        // Let that screen decide what Android Back should do.
        if (location.pathname === "/before-we-talk") {
          window.dispatchEvent(new Event("talkready:android-back"));
          return;
        }

        // On the Home screen, ask before closing the Android app.
        if (location.pathname === "/") {
          const shouldExit = window.confirm("Do you want to exit TALKREADY AI?");
          if (shouldExit) {
            void CapacitorApp.exitApp();
          }
          return;
        }

        // Prefer the previous in-app history entry. If the screen was
        // opened directly, safely return to Home instead of exiting.
        const historyIndex = window.history.state?.idx;
        if (typeof historyIndex === "number" && historyIndex > 0) {
          navigate(-1);
        } else {
          navigate("/", { replace: true });
        }
      });

      if (cancelled) {
        await handle.remove();
      } else {
        listener = handle;
      }
    };

    void registerListener().catch((error) => {
      console.error("Unable to register Android Back handler:", error);
    });

    return () => {
      cancelled = true;
      if (listener) void listener.remove();
    };
  }, [location.pathname, navigate]);

  return null;
}

function AppHeader() {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
      setSigningOut(false);
    }
  }

  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-5 sm:px-8 lg:px-10">
      <Link to="/" className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-700/10 bg-white/75 text-emerald-800 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.07] dark:text-emerald-200">
          <AudioLines size={23} />
        </span>
        <span>
          <span className="block text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
            TalkReady AI
          </span>
          <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
            Your speaking companion
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex h-10 items-center justify-center gap-2 rounded-full border border-white/80 bg-white/65 px-3 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-xl transition hover:bg-white disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/10 sm:px-4"
        >
          {signingOut ? <LoaderCircle size={16} className="animate-spin" /> : <LogOut size={16} />}
          <span className="hidden sm:inline">Log out</span>
        </button>

        <Link
          to="/profile"
          aria-label="Open profile"
          title="Profile settings"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/65 text-slate-700 shadow-sm backdrop-blur-xl transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-200 dark:focus-visible:ring-offset-slate-950"
        >
          <UserRound size={18} />
        </Link>
      </div>
    </header>
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[26px] border border-white/80 bg-white/60 shadow-[0_12px_38px_-24px_rgba(15,70,47,0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-black/10 ${className}`}
    >
      {children}
    </div>
  );
}

function QuickTool({
  icon,
  title,
  description,
  to,
  tone,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  to: string;
  tone: "green" | "blue" | "orange" | "purple";
}) {
  const toneClasses = {
    green: "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
    blue: "bg-sky-100/80 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200",
    orange: "bg-orange-100/80 text-orange-800 dark:bg-orange-400/15 dark:text-orange-200",
    purple: "bg-violet-100/80 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200",
  };

  return (
    <Link
      to={to}
      className="group flex min-h-[142px] flex-col rounded-[22px] border border-white/80 bg-white/55 p-4 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.08] sm:p-5"
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses[tone]}`}>
        {icon}
      </span>
      <span className="mt-4 flex items-center justify-between gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        {title}
        <ChevronRight size={16} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
      </span>
      <span className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span>
    </Link>
  );
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getCurrentStreak(dayKeys: Set<string>): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let current: Date | null = dayKeys.has(localDayKey(today))
    ? today
    : dayKeys.has(localDayKey(yesterday))
      ? yesterday
      : null;
  let streak = 0;

  while (current && dayKeys.has(localDayKey(current))) {
    streak += 1;
    const previous = new Date(current);
    previous.setDate(previous.getDate() - 1);
    current = previous;
  }
  return streak;
}

function Home({ user }: { user: User }) {
  const displayName = user.displayName?.trim().split(/\s+/)[0] || "there";
  const [practicedDays, setPracticedDays] = useState<Set<string>>(() => new Set());
  const [practiceSessions, setPracticeSessions] = useState<PracticeHistorySession[]>([]);
  const [streakLoading, setStreakLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPracticeInsights() {
      setStreakLoading(true);
      try {
        const sessions = await getPracticeSessions();
        const days = new Set<string>();
        sessions.forEach((session) => {
          if (session.createdAt) days.add(localDayKey(session.createdAt));
        });
        if (!cancelled) {
          setPracticeSessions(sessions);
          setPracticedDays(days);
        }
      } catch (error) {
        console.error("Unable to load dashboard practice insights:", error);
        if (!cancelled) {
          setPracticeSessions([]);
          setPracticedDays(new Set());
        }
      } finally {
        if (!cancelled) setStreakLoading(false);
      }
    }

    void loadPracticeInsights();
    return () => { cancelled = true; };
  }, [user.uid]);

  const currentStreak = getCurrentStreak(practicedDays);
  const totalPracticeSeconds = practiceSessions.reduce(
    (total, session) => total + Math.max(0, session.durationSeconds || 0),
    0,
  );
  const scoredSessions = practiceSessions.filter(
    (session) => Number.isFinite(session.averageMatch) && session.checkedSentences > 0,
  );
  const averageMatch = scoredSessions.length
    ? Math.round(scoredSessions.reduce((total, session) => total + session.averageMatch, 0) / scoredSessions.length)
    : 0;
  const bestMatch = scoredSessions.length
    ? Math.round(Math.max(...scoredSessions.map((session) => session.averageMatch)))
    : 0;
  const recentScoreChange = scoredSessions.length >= 2
    ? Math.round(scoredSessions[0].averageMatch - scoredSessions[1].averageMatch)
    : null;
  const recentSessions = practiceSessions.slice(0, 3);
  const formatPracticeDuration = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.round(seconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
  };
  const formatPracticeDate = (date: Date | null) => date
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date)
    : "Date unavailable";
  const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekStatus = weekDays.map((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { day, key: localDayKey(date), isFuture: date > today };
  });

  return (
    <main className="app-theme relative min-h-screen overflow-hidden bg-[#eff8f3] pb-24 text-slate-900 transition-colors duration-300 dark:bg-[#101b19] dark:text-white sm:pb-10">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-200/45 blur-[90px] dark:bg-emerald-700/15" />
        <div className="absolute right-[-100px] top-[28%] h-80 w-80 rounded-full bg-teal-200/30 blur-[100px] dark:bg-teal-700/10" />
        <div className="absolute bottom-[-120px] left-[25%] h-72 w-72 rounded-full bg-lime-100/50 blur-[100px] dark:bg-lime-700/10" />
      </div>

      <div className="relative">
        <AppHeader />

        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
          <section className="flex flex-col gap-5 pt-3 sm:flex-row sm:items-end sm:justify-between sm:pt-7">
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">YOUR SPEAKING SPACE</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                Hi, {displayName} <span aria-hidden="true">👋</span>
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                A little practice every day makes a big difference.
              </p>
            </div>
            <Link
              to="/progress"
              className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full border border-white/80 bg-white/65 px-4 text-sm font-semibold text-emerald-900 shadow-sm backdrop-blur-xl transition hover:bg-white sm:self-auto dark:border-white/10 dark:bg-white/[0.07] dark:text-emerald-200"
            >
              <TrendingUp size={17} />
              View insights
              <ArrowRight size={16} />
            </Link>
          </section>

          <section className="mt-7 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <GlassCard className="overflow-hidden bg-gradient-to-br from-[#d5f2df]/90 via-[#c7ecd6]/75 to-[#e8f8ed]/85 p-5 dark:from-emerald-950/65 dark:via-emerald-900/35 dark:to-teal-950/45 sm:p-7">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div className="max-w-lg">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-xs font-bold text-emerald-900 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.07] dark:text-emerald-200">
                    <Target size={14} />
                    DAILY GOAL
                  </span>
                  <h2 className="mt-4 text-2xl font-bold tracking-tight text-emerald-950 dark:text-white sm:text-3xl">
                    Make today count
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-emerald-950/75 dark:text-emerald-100/75">
                    Complete a short speaking session and keep building your confidence.
                  </p>
                  <Link
                    to="/practice"
                    className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-800 px-5 py-3 text-sm font-bold !text-white shadow-lg shadow-emerald-950/15 transition hover:-translate-y-0.5 hover:bg-emerald-900 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:bg-emerald-200"
                  >
                    Start practising
                    <ArrowRight size={17} />
                  </Link>
                </div>

                <div className="flex shrink-0 items-center justify-center sm:pr-3">
                  <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-[9px] border-white/70 bg-white/35 shadow-inner backdrop-blur-xl dark:border-white/15 dark:bg-white/[0.04]">
                    <div className="absolute inset-[-9px] rounded-full border-[9px] border-emerald-700/20 border-t-emerald-800 dark:border-emerald-200/15 dark:border-t-emerald-200" />
                    <div className="text-center">
                      <AudioLines size={24} className="mx-auto text-emerald-900 dark:text-emerald-200" />
                      <p className="mt-1 text-2xl font-extrabold text-emerald-950 dark:text-white">5</p>
                      <p className="text-[11px] font-semibold text-emerald-900/75 dark:text-emerald-100/75">MIN / DAY</p>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="flex flex-col justify-between p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Your streak</p>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{streakLoading ? "Checking…" : `${currentStreak} ${currentStreak === 1 ? "day" : "days"}`}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{currentStreak > 0 ? "Great work — keep your streak going!" : "Complete a speaking session to start your streak."}</p>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100/80 text-orange-700 dark:bg-orange-400/15 dark:text-orange-200">
                  <Flame size={25} />
                </span>
              </div>
              <div className="mt-5 grid grid-cols-7 gap-1.5">
                {weekStatus.map(({ day, key, isFuture }, index) => {
                  const completed = practicedDays.has(key);
                  const isToday = key === localDayKey(today);
                  return (
                    <div key={`${key}-${index}`} className="flex flex-col items-center gap-2">
                      <span
                        title={completed ? "Practice completed" : isFuture ? "Upcoming" : "No practice recorded"}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${completed ? "bg-emerald-700 text-white dark:bg-emerald-300 dark:text-emerald-950" : isToday ? "border-2 border-emerald-600 bg-white/70 text-emerald-700 dark:border-emerald-300 dark:bg-white/[0.04] dark:text-emerald-200" : "border border-slate-200/80 bg-white/50 text-slate-400 dark:border-white/10 dark:bg-white/[0.04]"}`}
                      >
                        {completed ? <CheckCircle2 size={15} /> : isFuture ? "·" : "·"}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{day}</span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </section>

          <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Practice insights">
            <GlassCard className="flex items-center gap-4 p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100/80 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200"><CalendarCheck size={23} /></span>
              <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Completed sessions</p><p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">{streakLoading ? "…" : practiceSessions.length}</p></div>
            </GlassCard>
            <GlassCard className="flex items-center gap-4 p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100/80 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200"><TrendingUp size={23} /></span>
              <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Average word match</p><p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">{scoredSessions.length ? `${averageMatch}%` : "—"}</p></div>
            </GlassCard>
            <GlassCard className="flex items-center gap-4 p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100/80 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200"><Award size={23} /></span>
              <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Best word match</p><p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">{scoredSessions.length ? `${bestMatch}%` : "—"}</p></div>
            </GlassCard>
            <GlassCard className="flex items-center gap-4 p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100/80 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200"><Clock3 size={23} /></span>
              <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total speaking time</p><p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">{streakLoading ? "…" : formatPracticeDuration(totalPracticeSeconds)}</p></div>
            </GlassCard>
          </section>
          <section className="mt-8">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">QUICK TOOLS</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">What would you like to practise?</h2>
              </div>
              <Link to="/practice" className="hidden items-center gap-1 text-sm font-bold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 sm:inline-flex">
                See all <ArrowRight size={16} />
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
              <QuickTool icon={<Mic size={22} />} title="SpeakCheck" description="Pronunciation & fluency" to="/speakcheck" tone="green" />
              <QuickTool icon={<MessageCircle size={22} />} title="Before We Talk" description="Practise real conversations" to="/before-we-talk" tone="blue" />
            </div>
          </section>

          <section className="mt-8 rounded-[26px] border border-white/80 bg-white/60 p-5 shadow-[0_12px_38px_-24px_rgba(15,70,47,0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">LEARN FROM YOUR HISTORY</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">Recent SpeakCheck sessions</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your saved results, scores, and practice time.</p>
                {recentScoreChange !== null && <p className={`mt-2 text-sm font-semibold ${recentScoreChange > 0 ? "text-emerald-700 dark:text-emerald-300" : recentScoreChange < 0 ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}>Recent score trend: {recentScoreChange > 0 ? "+" : ""}{recentScoreChange} percentage points vs. the previous scored session</p>}
              </div>
              <div className="flex gap-2">
                <Link to="/practice-history" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-300/20 dark:bg-white/[0.05] dark:text-emerald-200">Full history <ArrowRight size={15} /></Link>
                <Link to="/progress" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-emerald-800 px-4 py-2 text-sm font-bold !text-white transition hover:bg-emerald-900 dark:bg-emerald-300 dark:!text-emerald-950">Progress <TrendingUp size={15} /></Link>
              </div>
            </div>
            {streakLoading ? (
              <p className="mt-5 rounded-2xl bg-white/50 p-4 text-sm text-slate-500 dark:bg-white/[0.035] dark:text-slate-400">Loading saved sessions…</p>
            ) : recentSessions.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-5 text-sm leading-6 text-slate-600 dark:border-emerald-300/15 dark:bg-emerald-400/[0.04] dark:text-slate-300">
                No saved SpeakCheck sessions yet. Complete a practice session and your results will appear here.
                <Link to="/speakcheck" className="ml-1 font-bold text-emerald-800 underline dark:text-emerald-200">Start SpeakCheck</Link>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {recentSessions.map((session) => (
                  <article key={session.id} className="flex flex-col gap-3 rounded-2xl border border-emerald-100/80 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-100">SpeakCheck Practice</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatPracticeDate(session.createdAt)} · {session.checkedSentences} sentence{session.checkedSentences === 1 ? "" : "s"} · {session.selectedSpeed} pace</p>
                    </div>
                    <div className="flex items-center gap-4 sm:justify-end">
                      <div><p className="text-[11px] text-slate-500 dark:text-slate-400">Word match</p><p className="font-extrabold text-emerald-800 dark:text-emerald-200">{Math.round(session.averageMatch)}%</p></div>
                      <div><p className="text-[11px] text-slate-500 dark:text-slate-400">Duration</p><p className="font-bold text-slate-800 dark:text-slate-100">{formatPracticeDuration(session.durationSeconds)}</p></div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <GlassCard className="p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100/80 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200"><Target size={20} /></span>
                <div><h2 className="font-bold text-slate-900 dark:text-white">Your focus areas</h2><p className="text-xs text-slate-500 dark:text-slate-400">Areas to work on as you practise</p></div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Pronunciation", "Fluency", "Confidence"].map((item) => (
                  <span key={item} className="rounded-full border border-white/80 bg-white/55 px-3 py-2 text-xs font-semibold text-slate-700 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">{item}</span>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">Your focus areas can become more personalized as you complete practice sessions.</p>
            </GlassCard>

            <GlassCard className="flex items-center justify-between gap-4 p-5 sm:p-6">
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">YOUR NEXT STEP</p>
                <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">Ready to speak up?</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">Try a quick speaking session or practise a conversation before the real moment.</p>
                <Link to="/practice" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300">
                  Choose a practice mode <ArrowRight size={16} />
                </Link>
              </div>
              <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100/80 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200 sm:flex"><Sparkles size={26} /></span>
            </GlassCard>
          </section>

          <footer className="mt-8 border-t border-emerald-900/10 py-4 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
            TalkReady AI · Practice before the real moment.
          </footer>
        </div>
      </div>
    </main>
  );
}

function Practice() {
  const modes = [
    {
      title: "SpeakCheck",
      subtitle: "Pronunciation & fluency",
      description: "Read sentences aloud, practise clear pronunciation, and review your speaking performance with feedback.",
      features: ["Speech recognition", "Pronunciation feedback", "Daily speaking practice"],
      path: "/speakcheck",
      icon: Mic,
      accent: "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
      button: "Start SpeakCheck",
    },
    {
      title: "Before We Talk",
      subtitle: "AI conversation practice",
      description: "Build confidence with simulated job interviews, self-introductions, everyday conversations, and group discussions.",
      features: ["AI-powered conversations", "Choose your scenario", "Practise at your own pace"],
      path: "/before-we-talk",
      icon: MessageCircle,
      accent: "bg-sky-100/80 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200",
      button: "Start a conversation",
    },
  ];

  return (
    <main className="app-theme relative min-h-screen overflow-hidden bg-[#eff8f3] px-5 pb-28 pt-8 text-slate-900 dark:bg-[#101b19] dark:text-white sm:px-8 sm:pb-12 sm:pt-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-emerald-200/35 blur-[90px] dark:bg-emerald-700/10" />
        <div className="absolute right-[-100px] top-1/2 h-72 w-72 rounded-full bg-teal-200/25 blur-[90px] dark:bg-teal-700/10" />
      </div>
      <div className="relative mx-auto max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/60 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur-xl transition hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
          <ArrowLeft size={17} /> Back to Home
        </Link>

        <section className="mx-auto mt-8 max-w-3xl text-center sm:mt-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/60 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-emerald-200 sm:text-sm">
            <Sparkles size={15} /> YOUR PERSONAL SPEAKING STUDIO
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">How would you like to practise?</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400 sm:text-base">
            Choose a practice mode that matches your goal. Improve your pronunciation or prepare for real conversations with your AI speaking companion.
          </p>
        </section>

        <section className="mt-9 grid gap-5 md:mt-12 md:grid-cols-2 md:gap-6">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <article key={mode.title} className="group flex flex-col rounded-[28px] border border-white/80 bg-white/60 p-6 shadow-[0_16px_45px_-30px_rgba(15,70,47,0.35)] backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:bg-white/80 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.055] dark:hover:bg-white/[0.08] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${mode.accent}`}><Icon size={27} /></span>
                  <span className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/55 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300"><AudioLines size={14} /> Practice mode</span>
                </div>
                <p className="mt-7 text-sm font-bold text-emerald-800 dark:text-emerald-300">{mode.subtitle}</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{mode.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400 sm:text-base">{mode.description}</p>
                <ul className="mt-6 space-y-3">
                  {mode.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <CheckCircle2 size={17} className="shrink-0 text-emerald-700 dark:text-emerald-300" />{feature}
                    </li>
                  ))}
                </ul>
                <Link to={mode.path} className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-800 px-5 py-3 text-sm font-bold !text-white shadow-lg shadow-emerald-950/10 transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:bg-emerald-200">
                  {mode.button}<ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </article>
            );
          })}
        </section>
        <p className="mt-8 text-center text-xs leading-6 text-slate-500 dark:text-slate-500 sm:text-sm">Start with five minutes a day. Consistency builds confidence.</p>
      </div>
    </main>
  );
}

type LearningPreferences = {
  englishLevel: "beginner" | "intermediate" | "advanced";
  interests: string;
  correctionStyle: "gentle" | "direct" | "detailed";
};

const defaultLearningPreferences: LearningPreferences = {
  englishLevel: "intermediate",
  interests: "",
  correctionStyle: "gentle",
};

function ProfilePage({
  user,
  activeTheme,
  themePreference,
  onThemePreferenceChange,
}: {
  user: User;
  activeTheme: ActiveTheme;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preferences, setPreferences] = useState<LearningPreferences>(defaultLearningPreferences);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [preferencesError, setPreferencesError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName ?? "");
  }, [user.displayName]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      setPreferencesLoading(true);
      setPreferencesError("");
      try {
        const preferencesRef = doc(db, "users", user.uid, "profilePreferences", "settings");
        const snapshot = await getDoc(preferencesRef);
        if (cancelled) return;
        if (snapshot.exists()) {
          const data = snapshot.data();
          setPreferences({
            englishLevel: data.englishLevel === "beginner" || data.englishLevel === "advanced" ? data.englishLevel : "intermediate",
            interests: typeof data.interests === "string" ? data.interests : "",
            correctionStyle: data.correctionStyle === "direct" || data.correctionStyle === "detailed" ? data.correctionStyle : "gentle",
          });
        }
      } catch (loadError) {
        console.error("Unable to load Profile preferences:", loadError);
        if (!cancelled) setPreferencesError("Couldn't load your saved preferences. You can still update and save them.");
      } finally {
        if (!cancelled) setPreferencesLoading(false);
      }
    }

    void loadPreferences();
    return () => { cancelled = true; };
  }, [user.uid]);

  async function saveProfile(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const cleanName = displayName.trim();
    if (!cleanName) {
      setError("Please enter your display name.");
      return;
    }

    setSaving(true);
    try {
      const { updateProfile } = await import("firebase/auth");
      await updateProfile(user, { displayName: cleanName });
      setDisplayName(cleanName);
      setMessage("Your profile name has been updated.");
    } catch (saveError) {
      console.error("Unable to update profile:", saveError);
      setError("Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveLearningPreferences(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreferencesSaving(true);
    setPreferencesMessage("");
    setPreferencesError("");
    try {
      const preferencesRef = doc(db, "users", user.uid, "profilePreferences", "settings");
      await setDoc(preferencesRef, { ...preferences, updatedAt: serverTimestamp() }, { merge: true });
      setPreferencesMessage("Your learning preferences have been saved.");
    } catch (saveError) {
      console.error("Unable to save Profile preferences:", saveError);
      setPreferencesError("Couldn't save your preferences. Check your connection and Firestore rules, then try again.");
    } finally {
      setPreferencesSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut(auth);
    } catch (signOutError) {
      console.error("Sign out failed:", signOutError);
      setSigningOut(false);
    }
  }

  const initial = (user.displayName?.trim() || user.email?.trim() || "U").charAt(0).toUpperCase();
  const fieldClass = "mt-2 min-h-12 w-full rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:focus:border-emerald-300";
  const sectionClass = "mt-5 rounded-[26px] border border-white/80 bg-white/60 p-5 shadow-[0_12px_38px_-24px_rgba(15,70,47,0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055] sm:p-6";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eff8f3] px-4 pb-24 pt-6 text-slate-900 dark:bg-[#101b19] dark:text-white sm:px-8 sm:pb-12 sm:pt-9">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-emerald-200/35 blur-[90px] dark:bg-emerald-700/10" />
        <div className="absolute right-[-100px] top-[35%] h-80 w-80 rounded-full bg-teal-200/25 blur-[100px] dark:bg-teal-700/10" />
      </div>

      <div className="relative mx-auto max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/65 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm backdrop-blur-xl transition hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-emerald-200">
          <ArrowLeft size={17} /> Back to Home
        </Link>

        <header className="mt-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/60 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 shadow-sm backdrop-blur-xl dark:border-emerald-300/15 dark:bg-white/[0.05] dark:text-emerald-200">
            <Sparkles size={14} /> TALKREADY AI
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Your profile</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">Manage your account, learning preferences, progress, and app appearance.</p>
        </header>

        <section className="mt-7 grid gap-5 md:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[26px] border border-white/80 bg-white/60 p-5 shadow-[0_12px_38px_-24px_rgba(15,70,47,0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055] sm:p-6">
            <div className="h-20 rounded-2xl bg-gradient-to-r from-emerald-200/80 via-teal-100/80 to-lime-100/80 dark:from-emerald-900/50 dark:via-teal-900/30 dark:to-lime-900/20" />
            <div className="-mt-10 px-2">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Google account profile" referrerPolicy="no-referrer" className="h-20 w-20 rounded-[1.6rem] border-4 border-white object-cover shadow-md dark:border-[#152a25]" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] border-4 border-white bg-emerald-700 text-3xl font-extrabold text-white shadow-md dark:border-[#152a25] dark:bg-emerald-300 dark:text-emerald-950">{initial}</div>
              )}
              <h2 className="mt-4 break-words text-xl font-extrabold">{user.displayName || "TalkReady learner"}</h2>
              <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">{user.email || "Email not available"}</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-300/15 dark:bg-emerald-400/10 dark:text-emerald-200">
                <ShieldCheck size={15} /> Google account connected
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/80 bg-white/60 p-5 shadow-[0_12px_38px_-24px_rgba(15,70,47,0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055] sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200"><UserRound size={21} /></span>
              <div><h2 className="font-extrabold">Personal information</h2><p className="text-xs text-slate-500 dark:text-slate-400">Update the name shown in your app.</p></div>
            </div>
            <form onSubmit={saveProfile} className="mt-5 space-y-4">
              <div>
                <label htmlFor="profile-display-name" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Full name</label>
                <input id="profile-display-name" type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} autoComplete="name" placeholder="Enter your name" className={fieldClass} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Google email address</label>
                <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300"><Mail size={17} className="shrink-0 text-emerald-700 dark:text-emerald-300" /><span className="break-all">{user.email || "No email address available"}</span></div>
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Your email and profile photo come from your Google sign-in account.</p>
              </div>
              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-300/20 dark:bg-rose-400/10 dark:text-rose-200">{error}</p>}
              {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200">{message}</p>}
              <button type="submit" disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-800 px-5 py-3 text-sm font-bold !text-white shadow-lg shadow-emerald-950/10 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:bg-emerald-200">{saving && <LoaderCircle size={16} className="animate-spin" />}{saving ? "Saving changes…" : "Save profile"}</button>
            </form>
          </div>
        </section>

        <section className={sectionClass}>
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200"><BookOpen size={21} /></span><div><h2 className="font-extrabold">Learning preferences</h2><p className="text-xs text-slate-500 dark:text-slate-400">Personalise your learning space. These settings do not change Before We Talk.</p></div></div>
          <form onSubmit={saveLearningPreferences} className="mt-5 space-y-4">
            <div>
              <label htmlFor="english-level" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Your English level</label>
              <select id="english-level" value={preferences.englishLevel} disabled={preferencesLoading} onChange={(event) => setPreferences((current) => ({ ...current, englishLevel: event.target.value as LearningPreferences["englishLevel"] }))} className={fieldClass}>
                <option value="beginner" className="bg-white text-slate-900 dark:bg-[#152a25] dark:text-white">Beginner</option>
                <option value="intermediate" className="bg-white text-slate-900 dark:bg-[#152a25] dark:text-white">Intermediate</option>
                <option value="advanced" className="bg-white text-slate-900 dark:bg-[#152a25] dark:text-white">Advanced</option>
              </select>
            </div>
            <div>
              <label htmlFor="learning-interests" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Interests and skills</label>
              <textarea id="learning-interests" value={preferences.interests} disabled={preferencesLoading} onChange={(event) => setPreferences((current) => ({ ...current, interests: event.target.value }))} maxLength={500} rows={3} placeholder="For example: software development, interviews, technology, daily conversation" className={`${fieldClass} resize-y`} />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Separate topics with commas. Maximum 500 characters.</p>
            </div>
            <div>
              <label htmlFor="correction-style" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">How would you like feedback?</label>
              <select id="correction-style" value={preferences.correctionStyle} disabled={preferencesLoading} onChange={(event) => setPreferences((current) => ({ ...current, correctionStyle: event.target.value as LearningPreferences["correctionStyle"] }))} className={fieldClass}>
                <option value="gentle" className="bg-white text-slate-900 dark:bg-[#152a25] dark:text-white">Gentle and encouraging</option>
                <option value="direct" className="bg-white text-slate-900 dark:bg-[#152a25] dark:text-white">Direct and concise</option>
                <option value="detailed" className="bg-white text-slate-900 dark:bg-[#152a25] dark:text-white">Detailed explanations</option>
              </select>
            </div>
            {preferencesLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading your saved preferences…</p>}
            {preferencesError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-300/20 dark:bg-rose-400/10 dark:text-rose-200">{preferencesError}</p>}
            {preferencesMessage && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200">{preferencesMessage}</p>}
            <button type="submit" disabled={preferencesLoading || preferencesSaving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-violet-300 dark:text-violet-950 dark:hover:bg-violet-200">{preferencesSaving && <LoaderCircle size={16} className="animate-spin" />}{preferencesSaving ? "Saving preferences…" : "Save learning preferences"}</button>
          </form>
        </section>

        <section className={sectionClass}>
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-200"><Settings2 size={21} /></span><div><h2 className="font-extrabold">Appearance</h2><p className="text-xs text-slate-500 dark:text-slate-400">Choose how TalkReady AI looks on this device.</p></div></div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["system", "light", "dark"] as const).map((option) => (
              <button key={option} type="button" onClick={() => onThemePreferenceChange(option)} aria-pressed={themePreference === option} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold capitalize transition ${themePreference === option ? "border-emerald-600 bg-emerald-100 text-emerald-900 dark:border-emerald-300 dark:bg-emerald-300/15 dark:text-emerald-100" : "border-slate-200 bg-white/60 text-slate-600 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:bg-white/[0.07]"}`}>
                {option === "system" ? <Settings2 size={17} /> : option === "light" ? <Sun size={17} /> : <Moon size={17} />}
                {option === "system" ? "System default" : `${option} mode`}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Currently displaying {activeTheme} appearance.</p>
        </section>

        <section className={sectionClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200"><TrendingUp size={21} /></span><div><h2 className="font-extrabold">My progress</h2><p className="mt-1 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">Review your speaking scores, practice history, and improvement over time.</p></div></div>
            <div className="flex flex-wrap gap-2"><Link to="/progress" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-emerald-800 px-4 py-2 text-sm font-bold !text-white transition hover:bg-emerald-900 dark:bg-emerald-300 dark:!text-emerald-950">View progress <TrendingUp size={15} /></Link><Link to="/practice-history" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-300/20 dark:bg-white/[0.05] dark:text-emerald-200">History <BookOpen size={15} /></Link></div>
          </div>
        </section>

        <section className={sectionClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200"><ShieldCheck size={21} /></span><div><h2 className="font-extrabold">Account &amp; privacy</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">Your profile preferences and practice history are stored under your signed-in account. Only the matching account UID is allowed by the configured Firestore rules.</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Signed in as {user.email || "Google account"}.</p></div></div>
            <button type="button" onClick={handleSignOut} disabled={signingOut} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-rose-200 bg-white/70 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-300/20 dark:bg-white/[0.04] dark:text-rose-200 dark:hover:bg-rose-400/10">{signingOut ? <LoaderCircle size={16} className="animate-spin" /> : <LogOut size={16} />}{signingOut ? "Signing out…" : "Sign out"}</button>
          </div>
        </section>

        <section className={`${sectionClass} relative overflow-hidden`}>
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-start gap-4">
              <span className="mt-1 h-14 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-emerald-300 to-teal-500" />
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">Developer credits</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The person behind TALKREADY AI</p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-2xl font-extrabold tracking-tight">Vinay Kumbar</h3>
              <span className="mt-2 inline-flex rounded-full border border-emerald-300/40 bg-emerald-100/70 px-3 py-1.5 text-sm font-bold text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-300">
                Creator of TALKREADY AI
              </span>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                Hey, I'm Vinay — a developer who loves turning ideas into digital experiences. I blend creativity with code, explore emerging technologies, and build meaningful things for the web. Always curious, constantly learning, and creating something new. ✦
              </p>
            </div>

            <div className="mt-7">
              <div className="flex items-center gap-4">
                <p className="shrink-0 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Connect with me</p>
                <span className="h-px flex-1 bg-gradient-to-r from-emerald-400/50 to-transparent" />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <a href="https://www.instagram.com/mevinnu17/" target="_blank" rel="noopener noreferrer" aria-label="Open Instagram profile" className="group inline-flex min-h-14 items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white/55 px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-300/70 hover:bg-pink-50/70 hover:shadow-md dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-100 dark:hover:border-pink-300/30 dark:hover:bg-pink-400/[0.07]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white shadow-sm">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" />
                      <circle cx="12" cy="12" r="4.1" />
                      <circle cx="17.7" cy="6.6" r="1" fill="currentColor" stroke="none" />
                    </svg>
                  </span>
                  <span className="flex-1">Instagram</span>
                  <ExternalLink size={17} className="text-slate-400 transition group-hover:text-pink-500" />
                </a>

                <a href="https://www.linkedin.com/in/vinay-kumbar-0549a4388" target="_blank" rel="noopener noreferrer" aria-label="Open LinkedIn profile" className="group inline-flex min-h-14 items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white/55 px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300/70 hover:bg-sky-50/70 hover:shadow-md dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-100 dark:hover:border-sky-300/30 dark:hover:bg-sky-400/[0.07]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0A66C2] text-white shadow-sm">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                      <path d="M5.2 3.5a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2ZM3.5 9h3.4v11.5H3.5V9Zm5.5 0h3.3v1.6h.05A3.65 3.65 0 0 1 15.65 8.7c3.5 0 4.15 2.3 4.15 5.3v6.5h-3.45v-5.75c0-1.37-.03-3.13-1.9-3.13-1.9 0-2.2 1.48-2.2 3.03v5.85H9V9Z" />
                    </svg>
                  </span>
                  <span className="flex-1">LinkedIn</span>
                  <ExternalLink size={17} className="text-slate-400 transition group-hover:text-sky-500" />
                </a>

                <a href="https://github.com/vinaykumbar17" target="_blank" rel="noopener noreferrer" aria-label="Open GitHub profile" className="group inline-flex min-h-14 items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white/55 px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400/70 hover:bg-slate-100/80 hover:shadow-md dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-100 dark:hover:border-white/25 dark:hover:bg-white/[0.08]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                      <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.08c-3.1.67-3.76-1.32-3.76-1.32-.5-1.28-1.24-1.62-1.24-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.7 2.62 1.21 3.26.92.1-.72.39-1.21.71-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.11-1.45 3.04-1.15 3.04-1.15.61 1.54.23 2.68.12 2.96.71.78 1.14 1.78 1.14 3 0 4.29-2.62 5.23-5.11 5.51.4.35.76 1.02.76 2.06v3.07c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" />
                    </svg>
                  </span>
                  <span className="flex-1">GitHub</span>
                  <ExternalLink size={17} className="text-slate-400 transition group-hover:text-slate-700 dark:group-hover:text-white" />
                </a>

                <a href="mailto:vinaykumbar17@gmail.com" aria-label="Send an email to Vinay" className="group inline-flex min-h-14 items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white/55 px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-emerald-50/70 hover:shadow-md dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-100 dark:hover:border-emerald-300/30 dark:hover:bg-emerald-400/[0.07]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 via-amber-400 to-emerald-500 text-white shadow-sm">
                    <Mail size={21} />
                  </span>
                  <span className="flex-1">Gmail</span>
                  <ExternalLink size={17} className="text-slate-400 transition group-hover:text-emerald-500" />
                </a>

                <a href="https://portfolio-vinayk.vercel.app/" target="_blank" rel="noopener noreferrer" aria-label="Open developer portfolio" className="group inline-flex min-h-14 items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white/55 px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-emerald-50/70 hover:shadow-md dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-100 dark:hover:border-emerald-300/30 dark:hover:bg-emerald-400/[0.07] sm:col-span-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                    <Globe2 size={23} />
                  </span>
                  <span className="flex-1">Developer portfolio</span>
                  <ExternalLink size={17} className="text-slate-400 transition group-hover:text-emerald-500" />
                </a>
              </div>
              <p className="mt-3 break-all text-xs text-slate-500 dark:text-slate-400">Public contact: vinaykumbar17@gmail.com</p>
            </div>

            <div className="mt-7 rounded-[22px] border border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 px-5 py-5 text-center shadow-inner dark:border-emerald-300/20 dark:from-emerald-400/[0.08] dark:via-teal-400/[0.06] dark:to-emerald-400/[0.08]">
              <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                Made with <span className="mx-2 text-xl text-rose-500" aria-label="love">♥</span> by <span className="font-extrabold text-emerald-700 dark:text-emerald-300">Vinay</span>
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-6 border-t border-emerald-900/10 py-4 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">TalkReady AI · Practice before the real moment.</footer>
      </div>
    </main>
  );
}

function WithBottomNavigation({ children }: { children: ReactNode }) {
  return (
    <>
      <div>{children}</div>
      <div className="sm:hidden">
        <BottomNavigation />
      </div>
    </>
  );
}

export default function App() {
  const { activeTheme, preference, setPreference } = useAppTheme();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
      },
      (error) => {
        console.error("Firebase authentication check failed:", error);
        setUser(null);
        setAuthLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  return (
    <>
      <AndroidBackButtonHandler />
      <Routes>
      <Route
        path="/auth"
        element={
          authLoading ? <LoadingScreen /> : user ? <Navigate to="/" replace /> : <Auth />
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute user={user} loading={authLoading}>
            {user && (
              <WithBottomNavigation>
                <Home user={user} />
              </WithBottomNavigation>
            )}
          </ProtectedRoute>
        }
      />

      <Route
        path="/practice"
        element={
          <ProtectedRoute user={user} loading={authLoading}>
            <WithBottomNavigation><Practice /></WithBottomNavigation>
          </ProtectedRoute>
        }
      />

      <Route
        path="/speakcheck"
        element={
          <ProtectedRoute user={user} loading={authLoading}>
            <WithBottomNavigation><SpeakCheck /></WithBottomNavigation>
          </ProtectedRoute>
        }
      />

      <Route
        path="/practice-history"
        element={
          <ProtectedRoute user={user} loading={authLoading}>
            <WithBottomNavigation><PracticeHistory /></WithBottomNavigation>
          </ProtectedRoute>
        }
      />

      <Route
        path="/progress"
        element={
          <ProtectedRoute user={user} loading={authLoading}>
            <WithBottomNavigation><Progress /></WithBottomNavigation>
          </ProtectedRoute>
        }
      />

      <Route
        path="/before-we-talk"
        element={
          <ProtectedRoute user={user} loading={authLoading}>
            <WithBottomNavigation><BeforeWeTalk /></WithBottomNavigation>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute user={user} loading={authLoading}>
            <WithBottomNavigation>
                {user && (
                  <ProfilePage
                    user={user}
                    activeTheme={activeTheme}
                    themePreference={preference}
                    onThemePreferenceChange={setPreference}
                  />
                )}
              </WithBottomNavigation>
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={
          <main className="min-h-screen bg-[#eff8f3] p-8 text-center text-slate-900 dark:bg-[#101b19] dark:text-white">
            <h1 className="text-2xl font-bold">Page not found</h1>
            <Link to="/" className="mt-4 inline-block font-semibold text-emerald-800 underline dark:text-emerald-300">Return home</Link>
          </main>
        }
      />
      </Routes>
    </>
  );
}
