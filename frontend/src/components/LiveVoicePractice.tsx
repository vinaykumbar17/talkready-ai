import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  ArrowLeft,
  ShieldCheck,
  Clock3,
  AudioLines,
  MessageSquareText,
  ChartNoAxesColumnIncreasing,
  Lightbulb,
  RotateCcw,
} from "lucide-react";
import { saveConversationReport } from "../lib/conversationProgress";
import { Capacitor, registerPlugin } from "@capacitor/core";
type MicrophonePermissionPlugin = {
  request(): Promise<void>;
};
const MicrophonePermission =
  registerPlugin<MicrophonePermissionPlugin>("MicrophonePermission");
type Props = {
  scenario: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  onClose?: () => void;
  autoStart?: boolean;
  initialVoice?: string;
};
type TranscriptLine = { speaker: "user" | "assistant"; text: string };
type CallPhase = "ready" | "connecting" | "active" | "finishing" | "ended";
const VOICES = [
  { name: "Kore", label: "Nisha Kapoor · Kore · Warm" },
  { name: "Aoede", label: "Ananya Rao · Aoede · Bright" },
  { name: "Charon", label: "Arjun Mehta · Charon · Deep" },
  { name: "Fenrir", label: "James Wilson · Fenrir · Energetic" },
  { name: "Puck", label: "Daniel Carter · Puck · Friendly" },
];
const VOICE_IDENTITIES: Record<string, { name: string; role: string; avatar: string; origin: string }> = {
  Kore: { name: "Nisha Kapoor", role: "AI Interviewer", avatar: "/avatars/nisha-kapoor.jpg", origin: "India" },
  Aoede: { name: "Ananya Rao", role: "AI Interviewer", avatar: "/avatars/ananya-rao.jpg", origin: "India" },
  Charon: { name: "Arjun Mehta", role: "AI Interviewer", avatar: "/avatars/arjun-mehta.jpg", origin: "India" },
  Fenrir: { name: "James Wilson", role: "AI Interviewer", avatar: "/avatars/james-wilson.jpg", origin: "United Kingdom" },
  Puck: { name: "Daniel Carter", role: "AI Interviewer", avatar: "/avatars/daniel-carter.jpg", origin: "United States" },
};
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://10.45.39.218:8000"
).replace(/\/$/, "");
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
function resampleTo16k(input: Float32Array, sourceRate: number): Int16Array {
  if (sourceRate === 16000) {
    const exact = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      exact[i] = sample < 0 ? sample * 32768 : sample * 32767;
    }
    return exact;
  }
  const ratio = sourceRate / 16000;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    let count = 0;
    for (let j = start; j < Math.max(start + 1, end); j++) {
      sum += input[Math.min(j, input.length - 1)];
      count++;
    }
    const sample = Math.max(-1, Math.min(1, sum / Math.max(count, 1)));
    output[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return output;
}
function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}
function scoreTranscript(lines: TranscriptLine[]) {
  const userText = lines
    .filter((line) => line.speaker === "user")
    .map((line) => line.text)
    .join(" ")
    .trim();
  const words = userText.match(/\b[\w'-]+\b/g) ?? [];
  const sentences = userText.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const uniqueWords = new Set(words.map((word) => word.toLowerCase()));
  const fillers = (userText.match(/\b(um|uh|like|you know|actually)\b/gi) ?? []).length;
  const averageSentenceLength = words.length / Math.max(sentences.length, 1);
  const vocabulary = Math.min(100, Math.round(45 + (uniqueWords.size / Math.max(words.length, 1)) * 45));
  const fluency = Math.max(35, Math.min(96, Math.round(72 + Math.min(words.length, 120) / 8 - fillers * 4)));
  const grammar = Math.max(40, Math.min(95, Math.round(62 + Math.min(sentences.length, 8) * 3 + (averageSentenceLength >= 6 ? 6 : 0))));
  const clarity = Math.max(35, Math.min(95, Math.round(58 + Math.min(words.length, 100) / 5 - fillers * 2)));
  const overall = words.length < 8 ? null : Math.round((fluency + grammar + vocabulary + clarity) / 4);
  return {
    overall,
    fluency,
    grammar,
    vocabulary,
    clarity,
    words: words.length,
    uniqueWords: uniqueWords.size,
    fillers,
    userText,
  };
}
export default function LiveVoicePractice({ scenario, difficulty, onClose, autoStart = false, initialVoice = "Kore" }: Props) {
  const isLightTheme = document.documentElement.dataset.theme !== "dark";
  const [voice, setVoice] = useState(initialVoice);
  const [phase, setPhase] = useState<CallPhase>("ready");
  const [micEnabled, setMicEnabled] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [status, setStatus] = useState("Choose a voice and start your call.");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [aiLevel, setAiLevel] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [report, setReport] = useState<ReturnType<typeof scoreTranscript> | null>(null);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const reportSavedRef = useRef(false);
  const elapsedSecondsRef = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const nextPlayTimeRef = useRef(0);
  const mountedRef = useRef(true);
  const uiAudioContextRef = useRef<AudioContext | null>(null);
  const endingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishingRef = useRef(false);
  const phaseRef = useRef<CallPhase>("ready");
  const micEnabledRef = useRef(false);
  const setCallPhase = useCallback((next: CallPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCall(false, false);
      if (uiAudioContextRef.current) {
        void uiAudioContextRef.current.close().catch(() => {});
        uiAudioContextRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (phase !== "active") return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => {
        const nextValue = value + 1;
        elapsedSecondsRef.current = nextValue;
        return nextValue;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);
  function playCallTone(kind: "connecting" | "connected" | "ended") {
    try {
      const context = uiAudioContextRef.current ?? new AudioContext();
      uiAudioContextRef.current = context;
      if (context.state === "suspended") void context.resume();
      const notes =
        kind === "connecting"
          ? [{ frequency: 440, delay: 0, duration: 0.12 }]
          : kind === "connected"
            ? [
                { frequency: 523.25, delay: 0, duration: 0.12 },
                { frequency: 659.25, delay: 0.14, duration: 0.18 },
              ]
            : [
                { frequency: 659.25, delay: 0, duration: 0.12 },
                { frequency: 440, delay: 0.14, duration: 0.2 },
              ];
      const now = context.currentTime;
      for (const note of notes) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = note.frequency;
        const start = now + note.delay;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + note.duration + 0.02);
      }
    } catch {
      // Call tones are optional.
    }
  }
  function stopAudioCapture() {
    if (processorRef.current) {
      processorRef.current.port.onmessage = null;
      processorRef.current.port.close();
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current = null;
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch {}
      sourceRef.current = null;
    }
    if (micGainRef.current) {
      try { micGainRef.current.disconnect(); } catch {}
      micGainRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (inputContextRef.current) {
      void inputContextRef.current.close().catch(() => {});
      inputContextRef.current = null;
    }
    micEnabledRef.current = false;
    setMicEnabled(false);
    setMicLevel(0);
  }
    function stopCall(notifyServer = true, makeReport = true) {
    if (endingTimerRef.current) {
      clearTimeout(endingTimerRef.current);
      endingTimerRef.current = null;
    }
    stopAudioCapture();
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState === WebSocket.OPEN && notifyServer) {
      try { socket.send(JSON.stringify({ type: "end" })); } catch {}
    }
    if (socket && socket.readyState < WebSocket.CLOSING) {
      try { socket.close(); } catch {}
    }
    if (outputContextRef.current) {
      void outputContextRef.current.close().catch(() => {});
      outputContextRef.current = null;
    }
    nextPlayTimeRef.current = 0;
    setCallPhase("ended");
    setStatus("Call ended.");
    setMicLevel(0);
    setAiLevel(0);
    if (makeReport) {
      const finalReport = scoreTranscript(transcriptRef.current);
      setReport(finalReport);
      if (!reportSavedRef.current) {
        reportSavedRef.current = true;
        void saveConversationReport({
        scenario,
        difficulty,
        voice,
        durationSeconds: elapsedSecondsRef.current,
        overall: finalReport.overall,
        fluency: finalReport.fluency,
        grammar: finalReport.grammar,
        vocabulary: finalReport.vocabulary,
        clarity: finalReport.clarity,
        words: finalReport.words,
        uniqueWords: finalReport.uniqueWords,
        fillers: finalReport.fillers,
      }).catch((error) => {
          reportSavedRef.current = false;
          console.error("Unable to save call report:", error);
          setError("Your call report could not be saved. Please check your connection.");
        });
      }
    }
    playCallTone("ended");
  }
  async function enableMicrophone(socket: WebSocket) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    if (socketRef.current !== socket || socket.readyState !== WebSocket.OPEN) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;
    const context = new AudioContext();
    inputContextRef.current = context;
    await context.resume();
const source = context.createMediaStreamSource(stream);
await context.audioWorklet.addModule(
  "/audio-capture-worklet.js"
);
const processor = new AudioWorkletNode(
  context,
  "audio-capture-processor",
  {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  }
);
const silentGain = context.createGain();
silentGain.gain.value = 0;
sourceRef.current = source;
processorRef.current = processor;
micGainRef.current = silentGain;
processor.port.onmessage = (event: MessageEvent<Float32Array>) => {
  if (
    socket.readyState !== WebSocket.OPEN ||
    !micEnabledRef.current
  ) {
    return;
  }
  const input = event.data as Float32Array;
  let sumSquares = 0;
  for (let i = 0; i < input.length; i++) {
    sumSquares += input[i] * input[i];
  }
  const rms = Math.sqrt(
    sumSquares / Math.max(input.length, 1)
  );
  if (mountedRef.current) {
    setMicLevel(Math.min(1, rms * 5.5));
  }
  const pcm = resampleTo16k(input, context.sampleRate);
  if (pcm.length === 0) return;
  const bytes = new Uint8Array(pcm.buffer);
  try {
    socket.send(
      JSON.stringify({
        type: "audio",
        data: toBase64(bytes),
      })
    );
  } catch {}
};
source.connect(processor);
processor.connect(silentGain);
silentGain.connect(context.destination);
    micEnabledRef.current = true;
    setMicEnabled(true);
    setStatus("You're connected. Speak naturally.");
  }
  async function startCall() {
    if (phaseRef.current === "connecting" || phaseRef.current === "active") return;
    setError("");
    setTranscript([]);
    transcriptRef.current = [];
    setReport(null);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    nextPlayTimeRef.current = 0;
    reportSavedRef.current = false;
    finishingRef.current = false;
    micEnabledRef.current = false;
    setCallPhase("connecting");
    setStatus("Connecting to TalkReady AI…");
    playCallTone("connecting");
    try {
      if (Capacitor.isNativePlatform()) {
        await MicrophonePermission.request();
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is unavailable. Open the app on localhost or HTTPS and allow microphone permission.");
      }
      const wsUrl = API_BASE_URL.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
      const socket = new WebSocket(`${wsUrl}/api/conversation/live`);
      socketRef.current = socket;
      socket.onmessage = async (event) => {
        if (socketRef.current !== socket) return;
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          setError("The voice server sent an unreadable message.");
          return;
        }
        if (data.type === "ready") {
          try {
            const outputContext = new AudioContext({ sampleRate: 24000 });
            outputContextRef.current = outputContext;
            await outputContext.resume();
            setCallPhase("active");
            setStatus("You're connected. Speak naturally.");
            playCallTone("connected");
            await enableMicrophone(socket);
          } catch (err) {
            console.error("Live microphone startup error:", err);
            const errorDetails =
              err instanceof Error
                ? `${err.name}: ${err.message}`
                : String(err);
            setError(errorDetails);
            stopCall(true, false);
          }
        } else if (data.type === "transcript" && typeof data.text === "string") {
          const speaker: TranscriptLine["speaker"] = data.speaker === "user" ? "user" : "assistant";
          setTranscript((current) => {
            const last = current[current.length - 1];
            const next: TranscriptLine[] = last?.speaker === speaker
              ? [...current.slice(0, -1), { speaker, text: `${last.text} ${data.text}`.trim() }]
              : [...current, { speaker, text: data.text }];
            transcriptRef.current = next;
            return next;
          });
          if (speaker === "assistant") setAiLevel(0.35 + Math.random() * 0.55);
          else setMicLevel(0.25 + Math.random() * 0.65);
        } else if (data.type === "audio" && typeof data.data === "string") {
          try {
            const context = outputContextRef.current;
            if (!context) return;
            const binary = atob(data.data);
            const pcm = new Int16Array(binary.length / 2);
            for (let i = 0; i < pcm.length; i++) {
              pcm[i] = (binary.charCodeAt(i * 2) & 0xff) | (binary.charCodeAt(i * 2 + 1) << 8);
            }
            const audioBuffer = context.createBuffer(1, pcm.length, data.sample_rate || 24000);
            const channel = audioBuffer.getChannelData(0);
            let sumSquares = 0;
            for (let i = 0; i < pcm.length; i++) {
              channel[i] = pcm[i] / (pcm[i] < 0 ? 32768 : 32767);
              sumSquares += channel[i] * channel[i];
            }
            setAiLevel(Math.min(1, Math.sqrt(sumSquares / Math.max(pcm.length, 1)) * 5.5));
            const source = context.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(context.destination);
            const startAt = Math.max(context.currentTime + 0.02, nextPlayTimeRef.current);
            source.start(startAt);
            nextPlayTimeRef.current = startAt + audioBuffer.duration;
            source.onended = () => setAiLevel(0);
          } catch {
            setError("Received audio could not be played. Try restarting the call.");
          }
          } else if (data.type === "session_finished") {
            if (finishingRef.current) return;
            finishingRef.current = true;
            const context = outputContextRef.current;
            const remainingMs = context
            ? Math.max(
              0,
              (nextPlayTimeRef.current - context.currentTime) * 1000,
            )
            : 0;
          setCallPhase("finishing");
          if (data.reason === "no_response") {
            setStatus("No response received. Ending the call…");
            endingTimerRef.current = window.setTimeout(() => {
              setReport(null);
              stopCall(false, false);
              setStatus("Call ended because no response was received.");
            }, remainingMs + 300);
            return;
          }
          setStatus("Finishing your call…");
          endingTimerRef.current = window.setTimeout(
            () => stopCall(false, true),
            remainingMs + 300,
          );
        } else if (data.type === "error") {
          setError(data.message || "The voice connection failed.");
          setCallPhase("ready");
          setStatus("Connection error.");
        }
      };
      socket.onerror = () => {
        setError("Could not connect to the voice backend. Confirm the backend is running.");
        setCallPhase("ready");
        setStatus("Connection error.");
      };
      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
          stopAudioCapture();
          if (!finishingRef.current && mountedRef.current) {
            setCallPhase("ended");
            setStatus("Call disconnected.");
          }
        }
      };
      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: "start",
          scenario,
          difficulty,
          voice,
          resume_context: "",
        }));
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the voice call.");
      setCallPhase("ready");
      setStatus("Could not connect.");
      stopCall(false, false);
    }
  }
  useEffect(() => {
    if (!autoStart) return;
    const timer = window.setTimeout(() => {
      void startCall();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);
  function toggleMicrophone() {
    if (micEnabled) {
      micEnabledRef.current = false;
      streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = false; });
      setMicEnabled(false);
      setMicLevel(0);
      setStatus("Microphone muted.");
    } else {
      streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = true; });
      micEnabledRef.current = true;
      setMicEnabled(true);
      setStatus("Microphone on. Speak naturally.");
    }
  }
  function toggleSpeaker() {
    const next = !speakerEnabled;
    setSpeakerEnabled(next);
    if (outputContextRef.current) {
      if (next) void outputContextRef.current.resume();
      else void outputContextRef.current.suspend();
    }
  }
  const active = phase === "active" || phase === "finishing";
  const showInCallAvatar = phase === "connecting" || active;
  const selectedIdentity = VOICE_IDENTITIES[voice] ?? VOICE_IDENTITIES.Kore;
  const latestUserLine = [...transcript].reverse().find((line) => line.speaker === "user")?.text;
  const bars = Array.from({ length: 27 }, (_, index) => {
    const wave = Math.abs(Math.sin(index * 0.72)) * 0.35 + Math.abs(Math.cos(index * 0.31)) * 0.2;
    const activity = Math.max(micLevel, aiLevel);
    return 8 + wave * 32 + activity * (index % 4 === 0 ? 28 : 15);
  });
    if (phase === "ended" && report) {
    const metrics = [
      { label: "Fluency", value: report.fluency },
      { label: "Grammar", value: report.grammar },
      { label: "Vocabulary", value: report.vocabulary },
      { label: "Clarity", value: report.clarity },
    ];
    return (
      <section className={`fixed inset-0 z-[100] overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 ${isLightTheme ? "bg-[#eff8f3] text-slate-900" : "bg-[#061720] text-white"}`}>
        <div className="mx-auto max-w-3xl">
          <button type="button" onClick={onClose} className={`mb-6 inline-flex items-center gap-2 text-sm ${isLightTheme ? "text-slate-700 hover:text-slate-950" : "text-slate-300 hover:text-white"}`}>
            <ArrowLeft size={18} /> Back to Before We Talk
          </button>
          <div className={`rounded-3xl border p-5 shadow-xl backdrop-blur-xl sm:p-8 ${isLightTheme ? "border-emerald-900/10 bg-white/75 shadow-emerald-950/5" : "border-white/10 bg-white/[0.045] shadow-2xl"}`}>
            <div className="text-center">
              <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${isLightTheme ? "bg-emerald-100 text-emerald-800" : "bg-emerald-400/10 text-emerald-300"}`}>
                <ChartNoAxesColumnIncreasing size={32} />
              </span>
              <p className={`mt-5 text-xs font-bold uppercase tracking-[0.22em] ${isLightTheme ? "text-emerald-800" : "text-emerald-300"}`}>TALKREADY AI · CALL REPORT</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Your speaking review</h1>
              <p className={`mt-2 text-sm ${isLightTheme ? "text-slate-600" : "text-slate-400"}`}>{scenario} · {formatDuration(elapsedSeconds)} · {difficulty}</p>
              {report.overall === null ? (
                <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                  There was not enough transcribed speech to estimate a score. Try a longer call so the report has enough text to review.
                </div>
              ) : (
                <>
                  <div className={`mx-auto mt-7 flex h-32 w-32 flex-col items-center justify-center rounded-full border-[6px] sm:h-36 sm:w-36 ${isLightTheme ? "border-emerald-700/70 bg-emerald-100/70" : "border-emerald-300/80 bg-emerald-300/5"}`}>
                    <span className="text-4xl font-bold">{report.overall}%</span>
                    <span className={`mt-1 text-xs ${isLightTheme ? "text-emerald-800" : "text-emerald-200"}`}>Practice estimate</span>
                  </div>
                  <p className={`mx-auto mt-4 max-w-xl text-sm leading-6 ${isLightTheme ? "text-slate-700" : "text-slate-300"}`}>
                    This score is a text-based practice estimate from the transcript, not an acoustic pronunciation assessment. Pronunciation accuracy cannot be measured reliably from text alone.
                  </p>
                </>
              )}
            </div>
            <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2">
              {metrics.map((metric) => (
                <div key={metric.label} className={`rounded-2xl border p-4 ${isLightTheme ? "border-emerald-900/10 bg-white/80" : "border-white/10 bg-slate-900/70"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-sm ${isLightTheme ? "text-slate-700" : "text-slate-300"}`}>{metric.label}</span>
                    <span className={`font-semibold ${isLightTheme ? "text-emerald-800" : "text-emerald-300"}`}>{metric.value}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-200" style={{ width: `${metric.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-3">
              <div className={`rounded-2xl p-4 ${isLightTheme ? "bg-emerald-900/[0.04]" : "bg-white/[0.04]"}`}>
                <p className="text-xs text-slate-400">Words spoken</p>
                <p className="mt-1 text-2xl font-bold">{report.words}</p>
              </div>
              <div className={`rounded-2xl p-4 ${isLightTheme ? "bg-emerald-900/[0.04]" : "bg-white/[0.04]"}`}>
                <p className="text-xs text-slate-400">Different words</p>
                <p className="mt-1 text-2xl font-bold">{report.uniqueWords}</p>
              </div>
              <div className={`rounded-2xl p-4 ${isLightTheme ? "bg-emerald-900/[0.04]" : "bg-white/[0.04]"}`}>
                <p className="text-xs text-slate-400">Possible fillers</p>
                <p className="mt-1 text-2xl font-bold">{report.fillers}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 sm:mt-5 sm:p-5">
              <h2 className="flex items-center gap-2 font-semibold"><Lightbulb size={18} className={isLightTheme ? "text-emerald-700" : "text-emerald-300"} /> Personal practice tips</h2>
              <ul className={`mt-3 space-y-2 text-sm leading-6 ${isLightTheme ? "text-slate-700" : "text-slate-300"}`}>
                <li>• Answer with a clear point, one supporting detail, and a short conclusion.</li>
                <li>• Try to reduce repeated filler words and pause briefly to organise your thoughts.</li>
                <li>• Practise expanding short answers with a specific example from your experience.</li>
              </ul>
            </div>
            <div className={`mt-4 rounded-2xl border p-4 sm:mt-5 ${isLightTheme ? "border-emerald-900/10 bg-white/70" : "border-white/10 bg-slate-950/50"}`}>
              <button type="button" onClick={() => setShowTranscript((value) => !value)} className={`flex w-full items-center justify-between gap-3 text-left font-semibold ${isLightTheme ? "text-slate-900" : "text-white"}`}>
                <span className="flex items-center gap-2"><MessageSquareText size={18} className={isLightTheme ? "text-emerald-700" : "text-emerald-300"} /> Call transcript ({transcript.length} turns)</span>
                <span className={`text-sm ${isLightTheme ? "text-emerald-800" : "text-emerald-300"}`}>{showTranscript ? "Hide" : "View"}</span>
              </button>
              {showTranscript && (
                <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
                  {transcript.length ? transcript.map((line, index) => (
                    <div key={`${index}-${line.speaker}`}
                    className={`rounded-xl p-3 text-sm leading-6 ${
                      line.speaker === "user"
                        ? isLightTheme
                          ? "bg-emerald-50 text-emerald-950"
                          : "bg-emerald-400/10 text-emerald-50"
                        : isLightTheme
                          ? "bg-slate-100 text-slate-800"
                        : "bg-white/[0.05] text-slate-200"
                    }`}
                    >
                      <p className={`mb-1 text-xs font-bold ${isLightTheme ? "text-emerald-800" : "text-emerald-300"}`}>{line.speaker === "user" ? "You" : "TalkReady AI"}</p>
                      {line.text}
                    </div>
                  )) : <p className={`text-sm ${isLightTheme ? "text-slate-600" : "text-slate-400"}`}>No transcript was received during this call.</p>}
                </div>
              )}
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row">
              <button type="button" onClick={() => { setReport(null); setTranscript([]); transcriptRef.current = []; setElapsedSeconds(0); setCallPhase("ready"); setStatus("Choose a voice and start your call."); }} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-300">
                <RotateCcw size={18} /> Practise again
              </button>
              <button type="button" onClick={onClose} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-semibold text-white hover:bg-white/5">
                Back to scenarios
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className={`fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden ${isLightTheme ? "bg-[#eff8f3] text-slate-900" : "bg-[#061720] text-white"}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[20%] h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/[0.08] blur-3xl" />
        <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-teal-400/[0.08] blur-3xl" />
      </div>
      <header className="relative z-10 flex shrink-0 items-center justify-between px-4 py-2 sm:px-8 sm:py-5">
        <button type="button" onClick={() => { if (active || phase === "connecting") stopCall(true, false); onClose?.(); }} aria-label="Back" className={`flex h-10 w-10 items-center justify-center rounded-full border sm:h-11 sm:w-11 ${isLightTheme ? "border-emerald-900/10 bg-white/70 text-slate-800 hover:bg-white" : "border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/10"}`}>
          <ArrowLeft size={21} />
        </button>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${isLightTheme ? "border-emerald-700/15 bg-emerald-100 text-emerald-800" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"}`}>
          <ShieldCheck size={15} /> Secure practice
        </div>
        <div className="w-10 sm:w-11" />
      </header>
      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col items-center overflow-y-auto px-4 pb-3 text-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-5 sm:pb-7">
        <div className="mt-1 flex shrink-0 flex-col items-center sm:mt-3">
          {showInCallAvatar && (
            <div className="flex flex-col items-center">
              <div className={`relative h-36 w-36 overflow-hidden rounded-full border-2 shadow-[0_0_70px_rgba(52,211,153,0.12)] sm:h-56 sm:w-56 ${active ? "border-emerald-300" : "border-emerald-300/60"}`}>
                <img src={selectedIdentity.avatar} alt={`${selectedIdentity.name}, IT professional and AI interviewer`} className="h-full w-full object-cover object-top" />
                {active && <span className={`absolute right-2 top-2 h-3 w-3 rounded-full border-2 ${isLightTheme ? "border-[#eff8f3]" : "border-[#061720]"} bg-emerald-300`} />}
              </div>
            </div>
          )}
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:mt-6 sm:text-4xl">{showInCallAvatar ? selectedIdentity.name : "TalkReady AI"}</h1>
          <p className={`mt-1 text-sm sm:mt-2 sm:text-base ${isLightTheme ? "text-slate-700" : "text-slate-300"}`}>{scenario}</p>
          <p className={`mt-1 text-xs ${isLightTheme ? "text-slate-500" : "text-slate-500"}`}>{difficulty} practice · {showInCallAvatar ? selectedIdentity.role : "AI interviewer"}</p>
          <div className={`mt-3 flex items-center gap-2 text-xl font-medium tabular-nums tracking-wide sm:mt-5 sm:text-2xl ${isLightTheme ? "text-slate-900" : "text-white"}`}>
            <Clock3 size={19} className="text-slate-400" /> {formatDuration(elapsedSeconds)}
          </div>
          <p className={`mt-1 text-xs font-medium sm:mt-2 sm:text-sm ${phase === "active" ? (isLightTheme ? "text-emerald-700" : "text-emerald-300") : (isLightTheme ? "text-slate-700" : "text-slate-300")}`}>
            {phase === "connecting" ? "Connecting to TalkReady AI…" : phase === "active" ? status : phase === "finishing" ? "Finishing call…" : phase === "ended" ? status : "Ready when you are"}
          </p>
        </div>
        <div className={`mt-3 w-full shrink-0 rounded-3xl border px-3 py-3 backdrop-blur-xl sm:mt-9 sm:px-7 sm:py-6 ${isLightTheme ? "border-emerald-900/10 bg-white/65" : "border-white/[0.08] bg-white/[0.035]"}`}>
          <div className="flex h-12 items-center justify-center gap-[4px] sm:h-16 sm:gap-[5px]" aria-label="Live voice activity analyser">
            {bars.map((height, index) => (
              <span key={index} className="w-[3px] rounded-full bg-emerald-300 transition-all duration-100 sm:w-[4px]" style={{ height: `${Math.min(44, height)}px`, opacity: 0.45 + Math.min(0.55, Math.max(micLevel, aiLevel)) }} />
            ))}
          </div>
          <div className={`mt-2 flex items-center justify-center gap-2 text-[11px] sm:mt-3 sm:text-xs ${isLightTheme ? "text-slate-600" : "text-slate-400"}`}>
            <AudioLines size={15} className={isLightTheme ? "text-emerald-700" : "text-emerald-300"} />
            {aiLevel > micLevel ? "AI is speaking…" : micLevel > 0.08 && micEnabled ? "Listening to you…" : phase === "active" ? "Ready for your response" : "Voice activity analyser"}
          </div>
          {latestUserLine && active && (
            <p className={`mt-3 rounded-xl px-3 py-2 text-left text-xs leading-5 sm:mt-4 sm:px-4 sm:py-3 sm:text-sm sm:leading-6 ${isLightTheme ? "bg-white/80 text-slate-700" : "bg-slate-950/50 text-slate-300"}`}>
              <span className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide sm:text-xs ${isLightTheme ? "text-emerald-800" : "text-emerald-300"}`}>Your latest response</span>
              {latestUserLine}
            </p>
          )}
        </div>
        {phase === "ready" && (
          <div className="mt-3 w-full max-w-sm shrink-0 text-left sm:mt-5">
            <label htmlFor="live-voice-select" className={`mb-2 block text-sm font-semibold ${isLightTheme ? "text-slate-700" : "text-slate-300"}`}>Choose interviewer voice</label>
            <select id="live-voice-select" value={voice} onChange={(event) => setVoice(event.target.value)} className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-emerald-500 sm:py-3 ${isLightTheme ? "border-emerald-900/15 bg-white text-slate-900" : "border-white/10 bg-[#102832] text-white focus:border-emerald-300"}`}>
              {VOICES.map((item) => <option key={item.name} value={item.name}>{item.label}</option>)}
            </select>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className={`mt-3 w-full shrink-0 rounded-xl border p-3 text-left text-sm font-semibold leading-6 ${
              isLightTheme
                ? "border-rose-300 bg-rose-50 text-rose-800"
                : "border-rose-400/30 bg-rose-950/60 text-rose-200"
            }`}
          >
            {error}
          </p>
        )}
        <div className="mt-auto w-full shrink-0 pt-3 pb-2 sm:pt-8 sm:pb-0">
          {phase === "ready" || phase === "ended" ? (
            <button type="button" onClick={() => void startCall()} className="mx-auto inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-emerald-400/10 transition hover:bg-emerald-200 sm:py-4">
              <Phone size={19} /> Start voice call
            </button>
          ) : (
            <div className="mx-auto flex w-full max-w-sm items-start justify-between gap-1 sm:gap-5">
              <button type="button" onClick={toggleMicrophone} disabled={!active} aria-pressed={!micEnabled} className={`flex flex-1 flex-col items-center gap-1.5 text-xs disabled:opacity-40 sm:gap-2 sm:text-sm ${isLightTheme ? "text-slate-700" : "text-slate-200"}`}>
                <span className={`flex h-12 w-12 items-center justify-center rounded-full sm:h-16 sm:w-16 ${micEnabled ? (isLightTheme ? "bg-slate-200 text-slate-800" : "bg-slate-700") : "bg-emerald-300 text-slate-950"}`}>
                  {micEnabled ? <Mic size={22} /> : <MicOff size={22} />}
                </span>
                {micEnabled ? "Mute" : "Unmute"}
              </button>
              <button type="button" onClick={() => stopCall(true, true)} disabled={!active} className={`flex flex-1 flex-col items-center gap-1.5 text-xs font-medium disabled:opacity-40 sm:gap-2 sm:text-sm ${isLightTheme ? "text-slate-800" : "text-slate-100"}`}>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-400 sm:h-[72px] sm:w-[72px]">
                  <PhoneOff size={25} />
                </span>
                End call
              </button>
              <button type="button" onClick={toggleSpeaker} disabled={!active} aria-pressed={speakerEnabled} className={`flex flex-1 flex-col items-center gap-1.5 text-xs disabled:opacity-40 sm:gap-2 sm:text-sm ${isLightTheme ? "text-slate-700" : "text-slate-200"}`}>
                <span className={`flex h-12 w-12 items-center justify-center rounded-full sm:h-16 sm:w-16 ${speakerEnabled ? (isLightTheme ? "bg-slate-200 text-slate-800" : "bg-slate-700") : "bg-emerald-300 text-slate-950"}`}>
                  {speakerEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
                </span>
                Speaker
              </button>
            </div>
          )}
          {phase === "active" && (
            <button type="button" onClick={() => setShowTranscript((value) => !value)} className={`mt-3 inline-flex items-center gap-2 text-xs sm:mt-6 sm:text-sm ${isLightTheme ? "text-slate-600 hover:text-emerald-800" : "text-slate-400 hover:text-emerald-200"}`}>
              <MessageSquareText size={16} /> {showTranscript ? "Hide live transcript" : `View live transcript (${transcript.length} turns)`}
            </button>
          )}
        </div>
        {showTranscript && active && (
          <div className={`mt-3 max-h-48 w-full shrink-0 overflow-y-auto rounded-2xl border p-3 text-left sm:mt-4 sm:max-h-64 ${isLightTheme ? "border-emerald-900/10 bg-white/80" : "border-white/10 bg-slate-950/60"}`}>
            {transcript.length ? transcript.map((line, index) => (
              <div key={`${index}-${line.speaker}`} className={`mb-3 rounded-xl p-3 text-sm leading-6 last:mb-0 ${isLightTheme ? "bg-emerald-900/[0.04]" : "bg-white/[0.04]"}`}>
                <p className={`mb-1 text-xs font-bold ${isLightTheme ? "text-emerald-800" : "text-emerald-300"}`}>{line.speaker === "user" ? "You" : "TalkReady AI"}</p>
                {line.text}
              </div>
            )) : <p className="p-4 text-center text-sm text-slate-400">Your transcript will appear here.</p>}
          </div>
        )}
        <p className={`mt-2 shrink-0 pb-1 text-center text-[10px] leading-4 sm:mt-5 sm:text-[11px] sm:leading-5 ${isLightTheme ? "text-slate-500" : "text-slate-500"}`}>Speaking scores are shown as practice feedback, not a certified English proficiency result.</p>
      </div>
    </section>
  );
}
