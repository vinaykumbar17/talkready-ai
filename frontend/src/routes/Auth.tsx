
import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { Link, useNavigate } from "react-router-dom";
import {
  AudioLines,
  ArrowLeft,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { initializeSocialLogin } from "../lib/socialLogin";

type AuthMode = "login" | "signup";

const googleProvider = new GoogleAuthProvider();

export default function Auth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (password.length < 6) {
      setError("Your password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );

        await updateProfile(credential.user, {
          displayName: name.trim(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }

      navigate("/", { replace: true });
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String(err.code)
          : "";

      const messages: Record<string, string> = {
        "auth/email-already-in-use":
          "An account with this email already exists. Please log in.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/invalid-credential":
          "Incorrect email or password. Please try again.",
        "auth/user-not-found":
          "No account was found with this email. Please sign up.",
        "auth/wrong-password":
          "Incorrect email or password. Please try again.",
        "auth/weak-password":
          "Please choose a stronger password with at least 6 characters.",
        "auth/too-many-requests":
          "Too many attempts. Please wait and try again.",
        "auth/network-request-failed":
          "Network error. Check your internet connection.",
        "auth/operation-not-allowed":
          "This sign-in method is disabled in Firebase Console.",
      };

      setError(messages[code] ?? "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);

    try {
      if (Capacitor.isNativePlatform()) {
        await initializeSocialLogin();

        const response = await SocialLogin.login({
          provider: "google",
          options: {},
        });

        if (response.result.responseType !== "online") {
          throw new Error("Google did not return an online ID token.");
        }

        const idToken = response.result.idToken;

        if (!idToken) {
          throw new Error("Google did not return an ID token.");
        }

        const credential = GoogleAuthProvider.credential(idToken);

        await signInWithCredential(auth, credential);
      } else {
        await signInWithPopup(auth, googleProvider);
      }

      navigate("/", { replace: true });
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String(err.code)
          : "";

      const message =
        err instanceof Error ? err.message : "";

      const messages: Record<string, string> = {
        "auth/account-exists-with-different-credential":
          "An account already exists with this email using another sign-in method. Log in with that method first.",
        "auth/unauthorized-domain":
          "This domain is not authorized. Add it in Firebase Authentication settings.",
        "auth/operation-not-allowed":
          "Google sign-in is not enabled in Firebase Console.",
        "auth/network-request-failed":
          "Network error. Check your internet connection.",
      };

      setError(
        messages[code] ??
          (message || `Google sign-in failed${code ? ` (${code})` : ""}. Please try again.`),
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  const busy = loading || googleLoading;

  return (
    <main className="app-theme flex min-h-screen items-center justify-center bg-[#f7f7fc] px-4 py-8 text-slate-900 dark:bg-[#08080c] dark:text-white sm:px-6">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-300"
        >
          <ArrowLeft size={16} />
          Back to TalkReady AI
        </Link>

        <section className="rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-xl shadow-violet-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300">
              <AudioLines size={28} />
            </div>

            <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {mode === "login"
                ? "Sign in and continue improving your speaking skills."
                : "Start your journey towards confident communication."}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-white/[0.06]">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-white text-violet-700 shadow-sm dark:bg-white/10 dark:text-violet-300"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Log in
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
              }}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                mode === "signup"
                  ? "bg-white text-violet-700 shadow-sm dark:bg-white/10 dark:text-violet-300"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Sign up
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
          >
            {googleLoading ? (
              <LoaderCircle size={19} className="animate-spin" />
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 48 48"
                className="h-5 w-5"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 3.16 13.22l7.98 6.19C13.03 13.72 18.02 9.5 24 9.5Z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.92 46.98 31.8 46.98 24.55Z"
                />
                <path
                  fill="#FBBC05"
                  d="M11.14 28.59A14.4 14.4 0 0 1 10.35 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 3.16 10.78l7.98-6.19Z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.9 2.3-8.18 2.3-5.98 0-11.06-4.22-12.87-9.91l-7.98 6.19C6.5142.62 14.62 48 24 48Z"
                />
              </svg>
            )}
            {googleLoading ? "Connecting to Google..." : "Continue with Google"}
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            <span className="text-xs font-medium text-slate-500">
              OR CONTINUE WITH EMAIL
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="auth-name" className="mb-1.5 block text-sm font-medium">
                  Full name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  required
                  maxLength={80}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-white/[0.04]"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium">
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-white/[0.04]"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-white/[0.04]"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 hover:text-violet-600 dark:hover:text-violet-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <LoaderCircle size={18} className="animate-spin" />}
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {mode === "login"
              ? "New to TalkReady AI?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
              className="font-semibold text-violet-700 hover:underline dark:text-violet-300"
            >
              {mode === "login" ? "Create an account" : "Log in"}
            </button>
          </p>
        </section>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500 dark:text-slate-500">
          TalkReady AI · Practise a little. Improve every day.
        </p>
      </div>
    </main>
  );
}
