
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  CheckCircle2,
  MessageCircle,
  Mic,
  Sparkles,
} from "lucide-react";

const practiceModes = [
  {
    title: "SpeakCheck",
    subtitle: "Pronunciation & fluency",
    description:
      "Read sentences aloud, practise clear pronunciation, and review your speaking performance with instant feedback.",
    features: [
      "Speech recognition",
      "Pronunciation feedback",
      "Daily speaking practice",
    ],
    path: "/speakcheck",
    icon: Mic,
    accent:
      "bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
    button: "Start SpeakCheck",
  },
  {
    title: "Before We Talk",
    subtitle: "AI conversation practice",
    description:
      "Build confidence through simulated job interviews, self-introductions, everyday conversations, and group discussions.",
    features: [
      "AI-powered conversations",
      "Choose your scenario",
      "Practise at your own pace",
    ],
    path: "/before-we-talk",
    icon: MessageCircle,
    accent:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
    button: "Start a conversation",
  },
];

export default function Practice() {
  return (
    <main className="app-theme min-h-screen bg-[#f7f7fc] px-5 pb-28 pt-8 text-slate-900 dark:bg-[#08080c] dark:text-white sm:px-8 sm:pb-12 sm:pt-12">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-600 transition hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-300"
        >
          <ArrowLeft size={17} />
          Back to Home
        </Link>

        <section className="mx-auto mt-8 max-w-3xl text-center sm:mt-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/70 px-4 py-2 text-xs font-semibold text-violet-700 dark:border-violet-400/20 dark:bg-white/[0.04] dark:text-violet-300 sm:text-sm">
            <Sparkles size={15} />
            Your personal speaking studio
          </span>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
            How would you like to practise?
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400 sm:text-base">
            Choose a practice mode that matches your goal.
            Improve your pronunciation or prepare for real conversations
            with your AI speaking companion.
          </p>
        </section>

        <section className="mt-9 grid gap-5 md:mt-12 md:grid-cols-2 md:gap-6">
          {practiceModes.map((mode) => {
            const Icon = mode.icon;

            return (
              <article
                key={mode.title}
                className="group flex flex-col rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-950/5 dark:border-white/[0.09] dark:bg-white/[0.035] dark:hover:border-violet-400/30 sm:p-8"
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${mode.accent}`}
                  >
                    <Icon size={27} />
                  </span>

                  <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                    <AudioLines size={14} />
                    Practice mode
                  </span>
                </div>

                <p className="mt-7 text-sm font-semibold text-violet-700 dark:text-violet-300">
                  {mode.subtitle}
                </p>

                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {mode.title}
                </h2>

                <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400 sm:text-base">
                  {mode.description}
                </p>

                <ul className="mt-6 space-y-3">
                  {mode.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <CheckCircle2
                        size={17}
                        className="shrink-0 text-emerald-600 dark:text-emerald-400"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  to={mode.path}
                  className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/15 transition hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500"
                >
                  {mode.button}
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </article>
            );
          })}
        </section>

        <p className="mt-8 text-center text-xs leading-6 text-slate-500 dark:text-slate-500 sm:text-sm">
          Start with five minutes a day. Consistency builds confidence.
        </p>
      </div>
    </main>
  );
}
