import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Coffee,
  Users,
  Handshake,
  MessageCircle,
  Sparkles,
  Headset,
  GraduationCap,
  Building2,
  PhoneCall,
  Check,
} from "lucide-react";
import LiveVoicePractice from "../components/LiveVoicePractice";

type Scenario = {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: typeof MessageCircle;
};

const scenarios: Scenario[] = [
  {
    id: "interview",
    title: "Job Interview",
    description: "Practise answering common interview questions.",
    category: "Career",
    icon: BriefcaseBusiness,
  },
  {
    id: "introduction",
    title: "Self-Introduction",
    description: "Introduce yourself clearly and confidently.",
    category: "Personal",
    icon: Handshake,
  },
  {
    id: "everyday",
    title: "Everyday Life",
    description: "Build confidence in daily English conversations.",
    category: "Daily life",
    icon: Coffee,
  },
  {
    id: "customer-care",
    title: "Customer Care",
    description: "Practise asking for help and solving customer issues.",
    category: "Service",
    icon: Headset,
  },
  {
    id: "college",
    title: "College",
    description: "Practise conversations with classmates and teachers.",
    category: "Education",
    icon: GraduationCap,
  },
  {
    id: "workplace",
    title: "Workplace",
    description: "Practise professional conversations with colleagues.",
    category: "Career",
    icon: Building2,
  },
  {
    id: "group",
    title: "Group Discussion",
    description: "Share opinions and respond politely.",
    category: "Communication",
    icon: Users,
  },
  {
    id: "networking",
    title: "Meeting New People",
    description: "Start conversations and make a good first impression.",
    category: "Social",
    icon: MessageCircle,
  },
];

// Scenarios currently supported by the live-call backend.
const availableScenarioIds = new Set([
  "interview",
  "introduction",
  "group",
  "networking",
]);

const availableScenarios = scenarios.filter((scenario) =>
  availableScenarioIds.has(scenario.id),
);

const comingSoonScenarios = scenarios.filter(
  (scenario) => !availableScenarioIds.has(scenario.id),
);

const difficulties = ["Beginner", "Intermediate", "Advanced"] as const;
type Difficulty = (typeof difficulties)[number];

const interviewerVoices = [
  { name: "Kore", label: "Nisha Kapoor - Warm" },
  { name: "Aoede", label: "Ananya Rao - Bright" },
  { name: "Charon", label: "Arjun Mehta - Deep" },
  { name: "Fenrir", label: "James Wilson - Energetic" },
  { name: "Puck", label: "Daniel Carter - Friendly" },
] as const;

export default function BeforeWeTalk() {
  const navigate = useNavigate();
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
    availableScenarios[0],
  );

  const [difficulty, setDifficulty] = useState<Difficulty>("Beginner");
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);

  useEffect(() => {
    const handleAndroidBack = () => {
      if (activeScenario) {
        const shouldLeave = window.confirm(
          "Leave this voice practice? Your current session will end."
        );
        if (shouldLeave) {
          setActiveScenario(null);
        }
        return;
      }

      navigate("/", { replace: true });
    };

    window.addEventListener("talkready:android-back", handleAndroidBack);
    return () => {
      window.removeEventListener("talkready:android-back", handleAndroidBack);
    };
  }, [activeScenario, navigate]);

  if (activeScenario) {
    return (
      <LiveVoicePractice
        scenario={activeScenario.title}
        difficulty={difficulty}
        initialVoice={selectedVoice}
        autoStart
        onClose={() => setActiveScenario(null)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-5 pb-32 text-slate-900 dark:bg-transparent dark:text-white sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 transition hover:text-emerald-800 dark:text-emerald-300"
        >
          <ArrowLeft size={18} />
          Back to Home
        </Link>

        <header className="mt-5 rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-100/80 via-white/70 to-lime-100/60 p-5 text-slate-900 shadow-sm backdrop-blur-xl dark:border-emerald-300/15 dark:from-emerald-500/10 dark:via-slate-900/70 dark:to-teal-500/10 dark:text-white sm:mt-7 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-200/70 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300">
              <Sparkles size={25} />
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                TALKREADY AI
              </p>

              <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Before We Talk
              </h1>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            Choose a situation, set your speaking level, and connect to a live AI
            voice call.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
            {[
              "Live AI voice calls",
              "Real-life scenarios",
              "Speaking feedback",
            ].map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-emerald-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5"
              >
                {feature}
              </span>
            ))}
          </div>
        </header>

        {/* Working scenarios */}
        <section className="mt-6">
          <div className="mb-4">
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Choose your situation
            </h2>

            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Tap an icon to select a scenario. Your call will not start yet.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {availableScenarios.map((scenario) => {
              const Icon = scenario.icon;
              const isSelected = selectedScenario?.id === scenario.id;

              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => setSelectedScenario(scenario)}
                  aria-pressed={isSelected}
                  className={`relative flex min-h-[116px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-100/90 text-emerald-950 shadow-sm dark:border-emerald-400 dark:bg-emerald-400/15 dark:text-emerald-100"
                      : "border-white/80 bg-white/70 text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/70 dark:border-white/10 dark:bg-white/[0.045] dark:text-white dark:hover:border-emerald-400/40 dark:hover:bg-white/[0.07]"
                  }`}
                >
                  {isSelected && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-300 dark:text-emerald-950">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}

                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200 ${
                      isSelected
                        ? "bg-emerald-600 text-white dark:bg-emerald-300 dark:text-emerald-950"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                    }`}
                  >
                    <Icon size={22} strokeWidth={2} />
                  </span>

                  <span className="text-xs font-semibold leading-4 sm:text-sm">
                    {scenario.title}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Coming soon scenarios */}
          <div className="mt-7">
            <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              More Scenarios
            </h3>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {comingSoonScenarios.map((scenario) => {
                const Icon = scenario.icon;

                return (
                  <div
                    key={scenario.id}
                    aria-disabled="true"
                    className="flex min-h-[116px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/40 p-3 text-center opacity-80 dark:border-white/10 dark:bg-white/[0.025]"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200/70 text-slate-500 dark:bg-white/10 dark:text-slate-400">
                      <Icon size={22} strokeWidth={2} />
                    </span>

                    <span className="text-xs font-semibold leading-4 text-slate-700 dark:text-slate-300 sm:text-sm">
                      {scenario.title}
                    </span>

                    <span
                      className="text-[11px] italic font-medium text-red-500 dark:text-red-400"
                      style={{ fontFamily: '"Aptos", serif' }}
                    >
                      Coming Soon!
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedScenario && (
            <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-white/60 px-4 py-3 dark:border-emerald-300/15 dark:bg-white/[0.035]">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                {selectedScenario.title}
              </p>

              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">
                {selectedScenario.description}
              </p>
            </div>
          )}
        </section>

        {/* Difficulty and voice settings */}
        <section className="mt-6 rounded-3xl border border-white/80 bg-white/65 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] sm:p-6">
          <h2 className="font-extrabold">Choose difficulty</h2>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            How challenging would you like the conversation to be?
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {difficulties.map((level) => {
              const isSelected = difficulty === level;

              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  aria-pressed={isSelected}
                  className={`flex min-h-11 min-w-0 w-full items-center justify-center rounded-xl border px-1 py-2.5 text-center text-[11px] font-semibold leading-tight tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:px-3 sm:text-sm ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                      : "border-slate-200/80 bg-white/65 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-emerald-400/40 dark:hover:bg-emerald-400/10"
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <label
              htmlFor="interviewer-voice-before-call"
              className="mb-2 block text-sm font-bold"
            >
              Choose interviewer voice
            </label>

            <select
              id="interviewer-voice-before-call"
              value={selectedVoice}
              onChange={(event) => setSelectedVoice(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-[#102832] dark:text-white"
            >
              {interviewerVoices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.label}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Your selected voice will be used when the call connects.
            </p>
          </div>

          <button
            type="button"
            disabled={!selectedScenario}
            onClick={() => {
              if (selectedScenario) {
                setActiveScenario(selectedScenario);
              }
            }}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            <PhoneCall size={18} />
            Connect Call
          </button>

          <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            {selectedScenario
              ? `${selectedScenario.title} · ${difficulty} level`
              : "Choose a situation to continue"}
          </p>
        </section>
      </div>
    </main>
  );
}
