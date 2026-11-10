import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

import { useNavigate } from "react-router-dom";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

type NativeSpeechResult = { transcript: string; isFinal: boolean };
type NativeSpeechPlugin = {
  startListening(options?: { language?: string }): Promise<void>;
  stopListening(): Promise<void>;
  addListener(
    eventName: "speechResult",
    listenerFunc: (event: NativeSpeechResult) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "speechError",
    listenerFunc: (event: { message: string; code?: number }) => void,
  ): Promise<PluginListenerHandle>;
};
const NativeSpeechRecognition = registerPlugin<NativeSpeechPlugin>("NativeSpeechRecognition");

type Speed = "slow" | "medium" | "fast";
type Phase = "setup" | "running" | "paused" | "processing" | "finished";
type Attempt = {
  sentence: string;
  transcript: string;
  match: number;
  seconds: number;
  speed: Speed;
};
type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
};
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
};
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
const SESSION_SECONDS = 300;
const API_URL = "http://10.45.39.218:8000/api/speech/transcribe";
const DAILY_API_URL = "http://10.45.39.218:8000/api/sentences/daily";
const SILENCE_MS = 1600;
const MAX_RECORDING_MS = 20000;
const MIN_SPEECH_MS = 500;
const FEEDBACK_MS = 3500;
const SPEECH_THRESHOLD = 0.025;
const BANK: Record<Speed, string[]> = {
  slow: [
    "I believe that consistent practice helps me become a better communicator.",
    "Taking a deep breath helps me feel calm before I begin speaking.",
    "I want to express my ideas clearly and confidently in every conversation.",
    "Learning something new every day helps me grow personally and professionally.",
    "Good communication begins with listening carefully to other people.",
    "I am improving my speaking skills one sentence at a time.",
    "Speaking slowly gives me enough time to pronounce each word clearly.",
    "I can become more confident by practising a little every day.",
    "Clear communication helps people understand my thoughts and ideas.",
    "I will keep practising even when speaking feels difficult.",
    "Reading every morning helps me discover new words and ideas.",
    "A calm voice can make an important message easier to understand.",
    "I learn from my mistakes and use them to improve my skills.",
    "Patience and practice help me become a more confident speaker.",
    "Every person has a unique story worth sharing with others.",
    "I try to explain difficult topics using simple everyday language.",
    "Good habits become powerful when we practise them consistently.",
    "Asking thoughtful questions helps me understand people better.",
    "I prepare carefully before speaking in front of a group.",
    "Being a good listener is just as important as speaking well.",
    "I can express disagreement politely without hurting someone's feelings.",
    "Clear pronunciation helps people follow my message more easily.",
    "I feel more comfortable when I organize my thoughts in advance.",
    "Small steps taken regularly can lead to meaningful improvements.",
    "I want to speak naturally without rushing through my sentences.",
    "Learning from different people gives me a broader perspective.",
    "I take my time to finish each sentence clearly and confidently.",
    "Practising aloud helps me become familiar with new expressions.",
    "I focus on communicating my message rather than being perfect.",
    "A positive attitude helps me keep learning when things feel difficult.",
  ],
  medium: [
    "Confidence grows when I practise regularly and learn from mistakes.",
    "I try to explain my ideas using simple and clear language.",
    "Good preparation makes presentations easier and more effective.",
    "I learn something useful from every conversation I have.",
    "Listening carefully helps me respond with confidence and clarity.",
    "Small improvements every day can lead to excellent results.",
    "I can communicate better by organizing my thoughts first.",
    "Practice helps me speak naturally in unfamiliar situations.",
    "I stay calm and focused when explaining a difficult idea.",
    "Clear words and steady pacing make communication more effective.",
    "A thoughtful response is often better than a quick reaction.",
    "I enjoy learning practical skills that help me in daily life.",
    "Good teamwork depends on trust, respect, and open communication.",
    "I ask for feedback because it helps me identify areas to improve.",
    "Being prepared helps me handle unexpected questions with confidence.",
    "I try to make every conversation useful and respectful.",
    "Explaining an idea clearly is a valuable professional skill.",
    "I can improve my vocabulary by reading and speaking every day.",
    "A steady pace helps me sound more natural during presentations.",
    "I learn faster when I practise what I have recently discovered.",
    "Good communication can prevent confusion and strengthen relationships.",
    "I share my opinions confidently while respecting other perspectives.",
    "I focus on the main point before adding supporting details.",
    "Regular practice helps new expressions become part of everyday speech.",
    "I can handle difficult conversations by staying calm and respectful.",
    "Understanding the audience helps me choose the right words.",
    "I organize my ideas before explaining a complicated subject.",
    "A clear example can make an unfamiliar concept easier to understand.",
    "I welcome new challenges because they help me develop useful skills.",
    "Speaking with purpose makes conversations more effective.",
  ],
  fast: [
    "I learn quickly when I practise every day.",
    "Clear communication builds trust and confidence.",
    "I stay focused and speak with purpose.",
    "Every challenge gives me a chance to improve.",
    "I express my thoughts clearly and naturally.",
    "Consistent effort leads to meaningful progress.",
    "I listen carefully before giving my response.",
    "Confidence comes from preparation and practice.",
    "I welcome feedback and use it to improve.",
    "I can explain my ideas in a simple way.",
    "Good habits make everyday tasks easier.",
    "I enjoy learning something new each day.",
    "A calm mind helps me make better decisions.",
    "Practice makes difficult tasks feel more natural.",
    "I choose my words carefully and speak clearly.",
    "Teamwork helps us achieve shared goals.",
    "I stay curious and ask useful questions.",
    "Every conversation teaches me something valuable.",
    "I focus on progress instead of perfection.",
    "I speak with confidence and listen with care.",
    "Clear ideas make strong communication possible.",
    "I prepare well and handle challenges calmly.",
    "I turn useful feedback into positive action.",
    "I explain my point and support it with examples.",
    "Small changes can create lasting improvements.",
    "I keep my message simple and direct.",
    "I make time to learn and practise.",
    "Good listening leads to better understanding.",
    "I stay positive when learning something difficult.",
    "I share my ideas with clarity and respect.",
  ],
};
const ABOUT_MYSELF_SENTENCES = [
  "I graduated in Computer Science Engineering with a specialization in Artificial Intelligence and Machine Learning.",
  "I have experience building web applications using React and Node.js.",
  "My goal is to start my career as a software developer and keep improving my technical skills.",
  "I completed a full stack development internship where I learned to build practical applications.",
  "One of my strengths is learning new technologies through hands-on practice.",
  "I enjoy solving problems and turning ideas into useful software.",
  "I have worked with HTML, CSS, JavaScript, React, Node.js, and databases.",
  "My major project focused on automated video summarization and subtitle generation.",
  "I try to learn from feedback and improve the quality of my work.",
  "I am looking for an opportunity where I can contribute and grow as a developer.",
  "I use Git and code editors to organize and manage my development work.",
  "I enjoy working on projects that solve real problems for users.",
  "During my studies, I developed a strong interest in web development and artificial intelligence.",
  "I prepare for interviews by practising technical concepts and explaining them aloud.",
  "In the future, I want to become a skilled software developer and work with a good team."
];

const IT_DEVELOPMENT_SENTENCES = [
  "React uses reusable components to build interactive user interfaces.",
  "Node.js allows JavaScript to run on the server side.",
  "A REST API lets applications communicate through HTTP requests and responses.",
  "A database stores and organizes information so an application can retrieve it efficiently.",
  "HTML provides the structure of a web page, while CSS controls its presentation.",
  "JavaScript adds logic and interactive behaviour to web applications.",
  "Frontend development focuses on the parts of an application that users see and use.",
  "Backend development handles application logic, data processing, and server communication.",
  "MongoDB stores data in flexible document-oriented records.",
  "MySQL is a relational database that organizes data into tables.",
  "Firebase can provide authentication and real-time database services for an application.",
  "An HTTP GET request is commonly used to retrieve information from a server.",
  "An HTTP POST request is commonly used to submit data to a server.",
  "Responsive design helps a website work well on phones, tablets, and desktop screens.",
  "Git helps developers track code changes and collaborate on projects.",
  "A promise represents the eventual success or failure of an asynchronous operation.",
  "TypeScript adds static type checking to JavaScript.",
  "An API endpoint is a specific address where a client can access a service.",
  "Testing helps developers find defects before software is released.",
  "Authentication verifies who a user is before granting access."
];

const TECHNICAL_QA = [
  { question: "What is OOP?", answer: "Object-oriented programming organizes code around objects that contain data and methods." },
  { question: "What is encapsulation?", answer: "Encapsulation combines data and methods in a class and controls access to an object's internal state." },
  { question: "What is inheritance in Java?", answer: "Inheritance allows one class to reuse fields and methods from another class." },
  { question: "What is polymorphism?", answer: "Polymorphism allows the same interface or method name to show different behaviours in different contexts." },
  { question: "What is abstraction?", answer: "Abstraction hides unnecessary implementation details and exposes the essential features of an object." },
  { question: "What is a class in Java?", answer: "A class is a blueprint that defines the data and behaviour of objects." },
  { question: "What is an object in Java?", answer: "An object is an instance of a class with its own state and behaviour." },
  { question: "What is a constructor in Java?", answer: "A constructor initializes a new object when an instance of a class is created." },
  { question: "What is method overloading?", answer: "Method overloading defines multiple methods with the same name but different parameter lists." },
  { question: "What is method overriding?", answer: "Method overriding lets a subclass provide its own implementation of a method inherited from a parent class." },
  { question: "What is HTML?", answer: "HTML is a markup language used to structure content on web pages." },
  { question: "What is CSS?", answer: "CSS is used to style web pages by controlling layout, colours, spacing, and typography." },
  { question: "What is JavaScript?", answer: "JavaScript is a programming language used to add logic and interactivity to websites." },
  { question: "What is Python?", answer: "Python is a high-level programming language known for readable syntax and a wide range of applications." },
  { question: "What is a REST API?", answer: "A REST API lets clients interact with resources using standard HTTP methods." },
  { question: "What is JSON?", answer: "JSON is a lightweight text format for exchanging structured data between applications." },
  { question: "What is a variable?", answer: "A variable is a named place used to store a value that a program can access." },
  { question: "What is a function?", answer: "A function is a reusable block of code that performs a specific task." },
  { question: "What is an array?", answer: "An array stores an ordered collection of values that can be accessed by index." },
  { question: "What is a loop?", answer: "A loop repeats a block of code while a condition is satisfied or for each item in a collection." },
  { question: "What is a database?", answer: "A database is an organized collection of information that can be stored, searched, and updated." },
  { question: "What is SQL?", answer: "SQL is a language used to query and manage data in relational databases." },
  { question: "What is React?", answer: "React is a JavaScript library for building user interfaces from reusable components." },
  { question: "What is Node.js?", answer: "Node.js is a runtime that executes JavaScript outside the browser, often on servers." },
  { question: "What is debugging?", answer: "Debugging is the process of finding, understanding, and fixing errors in software." }
];

function createPracticePool(generalSource: string[]): string[] {
  const answerOnlyGeneral = generalSource.filter(
    (sentence) => sentence.trim() && !sentence.includes("?"),
  );
  const fallbackGeneral = BANK.medium.filter((sentence) => !sentence.includes("?"));
  const general = shuffled(answerOnlyGeneral).slice(0, 40);
  let fallbackIndex = 0;
  while (general.length < 40 && fallbackGeneral.length > 0) {
    general.push(fallbackGeneral[fallbackIndex % fallbackGeneral.length]);
    fallbackIndex += 1;
  }
  return shuffled([
    ...general,
    ...ABOUT_MYSELF_SENTENCES,
    ...IT_DEVELOPMENT_SENTENCES,
    ...TECHNICAL_QA.map((item) => item.answer)
  ]);
}

const SPEED_DETAILS: Record<
  Speed,
  { title: string; subtitle: string; target: string; rate: number }
> = {
  slow: {
    title: "Slow",
    subtitle: "Focus on clear words and complete sentences.",
    target: "8–12 seconds per sentence",
    rate: 0.78,
  },
  medium: {
    title: "Medium",
    subtitle: "Practise a natural conversational pace.",
    target: "5–8 seconds per sentence",
    rate: 0.95,
  },
  fast: {
    title: "Fast",
    subtitle: "Build fluency without rushing your words.",
    target: "3–5 seconds per sentence",
    rate: 1.12,
  },
};
function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}
type WordStatus = "correct" | "pronunciation" | "incorrect" | "missed" | "pending";
type SpeechFeedback = {
  sentence: string;
  statuses: WordStatus[];
  heard: (string | null)[];
  extras: string[];
  score: number;
  complete: boolean;
};
function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[-\u2013\u2014]/g, " ")
    .replace(/[^\p{L}\p{N}'\s]/gu, '')
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}
// UK/US spellings that speech engines choose between freely. Both sides are
// mapped to one form, so "practise" and "practice" are the same word.
const SPELLING_VARIANTS: Record<string, string> = {
  practise: "practice", practised: "practiced", practising: "practicing", practises: "practices",
  organise: "organize", organised: "organized", organising: "organizing", organises: "organizes",
  recognise: "recognize", recognised: "recognized", recognising: "recognizing",
  realise: "realize", realised: "realized", analyse: "analyze", analysed: "analyzed",
  colour: "color", favourite: "favorite", behaviour: "behavior", neighbour: "neighbor",
  centre: "center",
};
function canonical(word: string) {
  const plain = word.replace(/'/g, "");
  return SPELLING_VARIANTS[plain] ?? plain;
}
// Splits a contraction into its parts ("i'm" -> i am). Used so "I'm" can match
// the two words "I am" in either direction.
function expandContraction(word: string): string[] | null {
  if (!word.includes("'")) return null;
  if (word === "can't") return ["can", "not"];
  if (word === "won't") return ["will", "not"];
  if (word === "i'm") return ["i", "am"];
  const rules: [RegExp, string][] = [
    [/^(.+)n't$/, "not"], [/^(.+)'ll$/, "will"], [/^(.+)'ve$/, "have"], [/^(.+)'re$/, "are"],
  ];
  for (const [pattern, tail] of rules) {
    const match = word.match(pattern);
    if (match) return [match[1], tail];
  }
  return null;
}
function levenshtein(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}
// Reduces a word to a rough base form, so help/helps/helped/helping and
// vocabulary/vocabularies share one stem.
function wordStem(word: string) {
  let stem = word;
  if (stem.length > 5 && stem.endsWith("ies")) stem = stem.slice(0, -3) + "y";
  else if (stem.length > 5 && stem.endsWith("ing")) stem = stem.slice(0, -3).replace(/(.)\1$/, "$1");
  else if (stem.length > 4 && stem.endsWith("ed")) stem = stem.slice(0, -2).replace(/(.)\1$/, "$1");
  else if (stem.length > 5 && /(ch|sh|x|ss|z)es$/.test(stem)) stem = stem.slice(0, -2);
  else if (stem.length > 3 && stem.endsWith("s") && !stem.endsWith("ss")) stem = stem.slice(0, -1);
  else if (stem.length > 5 && stem.endsWith("ly")) stem = stem.slice(0, -2);
  if (stem.length > 3 && stem.endsWith("e")) stem = stem.slice(0, -1);
  return stem;
}
// Rough "sounds like" key: consonant skeleton with commonly confused sounds
// merged (th/t, b/p, d/t, g/k, v/f, z/s, l/r, sh, ch, ph, ck...).
function soundKey(word: string) {
  let w = word.replace(/'/g, "");
  w = w
    .replace(/^kn/, "n").replace(/^wr/, "r").replace(/ght/g, "t")
    .replace(/ph/g, "f").replace(/ck/g, "k").replace(/q/g, "k").replace(/x/g, "ks")
    .replace(/c(?=[eiy])/g, "s").replace(/c/g, "k")
    .replace(/sh/g, "S").replace(/ch/g, "C").replace(/th/g, "t").replace(/wh/g, "w");
  const merge: Record<string, string> = { b: "p", d: "t", g: "k", v: "f", z: "s", l: "r" };
  let key = "";
  for (const ch of w) {
    if ("aeiouyh".includes(ch)) continue;
    const mapped = merge[ch] ?? ch;
    if (key[key.length - 1] !== mapped) key += mapped;
  }
  return key;
}
function vowelGroups(word: string) {
  return (word.replace(/'/g, "").match(/[aeiouy]+/g) ?? []).length;
}
type Closeness = "exact" | "near" | "different";
// Decides how close a recognized word is to the target word. "near" means a
// plausible word-ending, spelling or sound-alike difference.
function compareWords(target: string, spoken: string): Closeness {
  const a = canonical(target);
  const b = canonical(spoken);
  if (a === b) return "exact";
  if (a.length < 3 || b.length < 3) return "different";
  if (wordStem(a) === wordStem(b)) return "near";
  const keyA = soundKey(a);
  const keyB = soundKey(b);
  const lengthRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  if (keyA === keyB && keyA.length >= 2 && lengthRatio >= 0.6 &&
      Math.abs(vowelGroups(a) - vowelGroups(b)) <= 1) return "near";
  // Longer words with one sound changed (speaking / sneaking).
  if (Math.min(a.length, b.length) >= 6 && levenshtein(keyA, keyB) <= 1 && levenshtein(a, b) <= 2) return "near";
  return "different";
}
type Move = {
  di: number;
  dj: number;
  cost: number;
  kind: "exact" | "near" | "sub" | "del" | "ins";
};
const COST_NEAR = 0.4;
const COST_SUB = 1;
const COST_GAP = 0.95; // slightly below 1 so "delete + insert" beats two substitutions
const LIVE_PROGRESS_BONUS = 0.06;
// Aligns the target words with the recognized words (dynamic programming, like
// edit distance). Order is preserved but words may be inserted, omitted,
// substituted or merged ("every day" / "everyday", "I'm" / "I am").
//   mode "final": the attempt is over, so unmatched target words are missed.
//   mode "live":  the user may still be speaking, so unreached words stay
//                 neutral and the unstable last word is not judged.
function analyzeSpeech(
  expectedText: string,
  spokenText: string,
  mode: "live" | "final",
  tentativeTail = false,
): SpeechFeedback {
  const target = words(expectedText);
  const spoken = words(spokenText);
  const n = target.length;
  const m = spoken.length;
  const statuses: WordStatus[] = target.map(() => "pending");
  const heard: (string | null)[] = target.map(() => null);
  const extras: string[] = [];
  const base: SpeechFeedback = {
    sentence: expectedText, statuses, heard, extras, score: 0, complete: mode === "final",
  };
  if (!n || !m) return base;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  const back: (Move | null)[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
  dp[0][0] = 0;
  const relax = (i: number, j: number, move: Move) => {
    const ni = i + move.di;
    const nj = j + move.dj;
    if (ni > n || nj > m) return;
    const cost = dp[i][j] + move.cost;
    if (cost < dp[ni][nj] - 1e-9) {
      dp[ni][nj] = cost;
      back[ni][nj] = move;
    }
  };
  const mergeTwoTargets = (i: number, j: number) => {
    // target[i] + target[i+1] spoken as the single word spoken[j]
    const joined = canonical(target[i]) + canonical(target[i + 1]);
    if (joined === canonical(spoken[j])) return true;
    const parts = expandContraction(spoken[j]);
    return !!parts && parts[0] === target[i] && parts[1] === target[i + 1];
  };
  const mergeTwoSpoken = (i: number, j: number) => {
    // target[i] spoken as the two words spoken[j] + spoken[j+1]
    const joined = canonical(spoken[j]) + canonical(spoken[j + 1]);
    if (joined === canonical(target[i])) return true;
    const parts = expandContraction(target[i]);
    return !!parts && parts[0] === spoken[j] && parts[1] === spoken[j + 1];
  };
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (dp[i][j] === Infinity) continue;
      if (i < n && j < m) {
        const closeness = compareWords(target[i], spoken[j]);
        relax(i, j, closeness === "exact"
          ? { di: 1, dj: 1, cost: 0, kind: "exact" }
          : closeness === "near"
            ? { di: 1, dj: 1, cost: COST_NEAR, kind: "near" }
            : { di: 1, dj: 1, cost: COST_SUB, kind: "sub" });
      }
      // Tiny position term: on exact ties, later words are the ones left unmatched.
      if (i < n) relax(i, j, { di: 1, dj: 0, cost: COST_GAP - 0.001 * i, kind: "del" });
      if (j < m) relax(i, j, { di: 0, dj: 1, cost: COST_GAP, kind: "ins" });
      if (i + 1 < n && j < m && mergeTwoTargets(i, j)) {
        relax(i, j, { di: 2, dj: 1, cost: 0, kind: "exact" });
      }
      if (i < n && j + 1 < m && mergeTwoSpoken(i, j)) {
        relax(i, j, { di: 1, dj: 2, cost: 0, kind: "exact" });
      }
    }
  }
  // Choose where the alignment ends. A finished attempt must consume every
  // target word; a live attempt may stop early (the rest is "not reached").
  let endI = n;
  if (mode === "live") {
    let best = Infinity;
    for (let i = 0; i <= n; i++) {
      const score = dp[i][m] - LIVE_PROGRESS_BONUS * i;
      if (score < best - 1e-9) {
        best = score;
        endI = i;
      }
    }
  }
  // Trace the best path back and record what happened to each target word.
  type Step = { move: Move; i: number; j: number };
  const steps: Step[] = [];
  let ci = endI;
  let cj = m;
  while (ci > 0 || cj > 0) {
    const move = back[ci][cj];
    if (!move) break;
    ci -= move.di;
    cj -= move.dj;
    steps.push({ move, i: ci, j: cj });
  }
  steps.reverse();
  const extraIndexes: number[] = [];
  for (const { move, i, j } of steps) {
    if (move.kind === "exact" || move.kind === "near" || move.kind === "sub") {
      const status: WordStatus =
        move.kind === "exact" ? "correct" : move.kind === "near" ? "pronunciation" : "incorrect";
      for (let k = 0; k < move.di; k++) {
        statuses[i + k] = status;
        heard[i + k] = spoken.slice(j, j + move.dj).join(" ");
      }
    } else if (move.kind === "del") {
      statuses[i] = "missed";
    } else {
      extraIndexes.push(j);
    }
  }
  if (mode === "live") {
    // The last recognized word may still be changing; do not judge it yet.
    if (tentativeTail) {
      const lastStep = steps[steps.length - 1];
      if (lastStep && lastStep.move.kind === "sub") {
        statuses[lastStep.i] = "pending";
        heard[lastStep.i] = null;
      } else if (lastStep && lastStep.move.kind === "ins") {
        extraIndexes.pop();
      }
    }
    // A skipped word counts as missed only after at least two later words
    // were matched; until then the user may simply be mid-sentence.
    let matchedAfter = 0;
    for (let i = n - 1; i >= 0; i--) {
      if (statuses[i] === "correct" || statuses[i] === "pronunciation") matchedAfter++;
      else if (statuses[i] === "missed" && matchedAfter < 2) statuses[i] = "pending";
    }
  }
  extraIndexes.forEach((index) => extras.push(spoken[index]));
  const exact = statuses.filter((s) => s === "correct").length;
  const near = statuses.filter((s) => s === "pronunciation").length;
  base.score = Math.round(((exact + 0.5 * near) / (n + extras.length)) * 100);
  return base;
}
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function getSuggestions(attempts: Attempt[]) {
  if (!attempts.length) {
    return {
      title: "Let's try again",
      items: [
        "Read each sentence aloud and keep your voice clear.",
        "Allow the microphone to capture the complete sentence.",
        "Try listening to the example before speaking.",
      ],
      missed: [] as string[],
    };
  }
  const missedCounts = new Map<string, number>();
  attempts.forEach((attempt) => {
    // Use the same alignment as the on-screen colours: every target word that
    // was not matched exactly (close, wrong or missed) is worth practising.
    const feedback = analyzeSpeech(attempt.sentence, attempt.transcript, "final");
    words(attempt.sentence).forEach((word, index) => {
      if (feedback.statuses[index] !== "correct") {
        missedCounts.set(word, (missedCounts.get(word) ?? 0) + 1);
      }
    });
  });
  const missed = [...missedCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
  const average =
    attempts.reduce((sum, item) => sum + item.match, 0) / attempts.length;
  const items: string[] = [];
  if (average < 85) {
    items.push(
      "Read the whole sentence slowly once, then repeat it at your normal pace.",
    );
  } else {
    items.push(
      "Good word matching. Keep focusing on clear endings and natural pauses.",
    );
  }
  if (missed.length) {
    items.push(
      `Practise these words in short phrases: ${missed.join(", ")}.`,
    );
    items.push(
      "Listen to the example, say each difficult word slowly, then read the full sentence again.",
    );
  } else {
    items.push(
      "No repeated missing words were identified in the checked transcripts.",
    );
  }
  const averageTime =
    attempts.reduce((sum, item) => sum + item.seconds, 0) / attempts.length;
  if (averageTime < 3) {
    items.push(
      "Slow down slightly. Leave enough time to finish every word clearly.",
    );
  } else if (averageTime > 13) {
    items.push(
      "Try reading in short phrases while keeping your pauses natural.",
    );
  }
  return {
    title: average >= 90 ? "Strong work today!" : "Your next steps",
    items,
    missed,
  };
}
export default function SpeakCheck() {
  const navigate = useNavigate();
  const [signedInUser, setSignedInUser] = useState(auth.currentUser);
  const [saveStatus, setSaveStatus] = useState("");
  const sessionSavedRef = useRef(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setSignedInUser(user);
    });
  }, []);

  const [speed, setSpeed] = useState<Speed>("medium");
  const [dailySentencesLoading, setDailySentencesLoading] = useState(true);
  const [dailySentencesError, setDailySentencesError] = useState("");
  const fallbackPracticePool = createPracticePool(BANK.medium);
  const sentenceBankRef = useRef<Record<Speed, string[]>>({
    slow: fallbackPracticePool,
    medium: fallbackPracticePool,
    fast: fallbackPracticePool,
  });
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS);
  const [phase, setPhase] = useState<Phase>("setup");
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [results, setResults] = useState<Attempt[]>([]);
  const [transcript, setTranscript] = useState("");
  const [liveWords, setLiveWords] = useState("");
  const [currentMatch, setCurrentMatch] = useState<number | null>(null);
  const [speakingTime, setSpeakingTime] = useState<number | null>(null);
  const [message, setMessage] = useState(
    "Choose your speed, then press Start.",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [liveTentative, setLiveTentative] = useState(false);

  const [liveError, setLiveError] = useState("");
  const [finalFeedback, setFinalFeedback] = useState<SpeechFeedback | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<Recognition | null>(null);
  const nativeSpeechListenersRef = useRef<PluginListenerHandle[]>([]);
  const nativeSpeechActiveRef = useRef(false);
  const recognitionSupportedRef = useRef(false);
  const committedLiveRef = useRef("");
  const sessionLiveRef = useRef("");
  const recognitionFatalRef = useRef(false);
  const sentenceRef = useRef("");
  const secondsRef = useRef(SESSION_SECONDS);
  const phaseRef = useRef<Phase>("setup");
  const speedRef = useRef<Speed>("medium");
  const sentenceIndexRef = useRef(0);
  const startedAtRef = useRef(0);
  const speechStartedRef = useRef(0);
  const silenceStartedRef = useRef(0);
  const discardRef = useRef(false);
  const processingRef = useRef(false);
  const finishedRef = useRef(false);
  const sessionIdRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderRef = useRef<Record<Speed, string[]>>({
    slow: shuffled(sentenceBankRef.current.slow),
    medium: shuffled(sentenceBankRef.current.medium),
    fast: shuffled(sentenceBankRef.current.fast),
  });
  const seenRef = useRef<Record<Speed, Set<string>>>({
    slow: new Set(),
    medium: new Set(),
    fast: new Set(),
  });
  useEffect(() => {
    let cancelled = false;
    async function loadDailySentences() {
      try {
        setDailySentencesLoading(true);
        setDailySentencesError("");
        const response = await fetch(DAILY_API_URL);
        if (!response.ok) {
          throw new Error(
            `Daily sentences could not be loaded (HTTP ${response.status}).`,
          );
        }
        const data = await response.json();
        const sentences = Array.isArray(data.sentences)
          ? data.sentences.filter(
              (item: unknown): item is string =>
                typeof item === "string" && item.trim().length > 0,
            )
          : [];
        if (sentences.length !== 200) {
          throw new Error(
            "The daily sentence API did not return 200 sentences.",
          );
        }
        if (cancelled) return;
        // Keep the session distribution at 40% general, 15% about myself,
        // 20% IT/development, and 25% spoken technical answers.
        const practicePool = createPracticePool(sentences);
        sentenceBankRef.current = {
          slow: practicePool,
          medium: practicePool,
          fast: practicePool,
        };
        orderRef.current = {
          slow: shuffled(practicePool),
          medium: shuffled(practicePool),
          fast: shuffled(practicePool),
        };
        seenRef.current = {
          slow: new Set(),
          medium: new Set(),
          fast: new Set(),
        };
      } catch (error) {
        if (cancelled) return;
        setDailySentencesError(
          error instanceof Error
            ? error.message
            : "Could not load daily sentences.",
        );
        // The original BANK remains available as a fallback.
      } finally {
        if (!cancelled) setDailySentencesLoading(false);
      }
    }
    void loadDailySentences();
    return () => {
      cancelled = true;
    };
  }, []);
  const startRecordingRef = useRef<() => Promise<void>>(async () => {});
  const finishSessionRef = useRef<() => void>(() => {});
  const currentSentence =
    orderRef.current[speed][sentenceIndex % orderRef.current[speed].length] ??
    sentenceBankRef.current[speed][0];
  const elapsed = SESSION_SECONDS - secondsLeft;
  const progress = (elapsed / SESSION_SECONDS) * 100;
  const averageMatch = results.length
    ? Math.round(
        results.reduce((sum, result) => sum + result.match, 0) /
          results.length,
      )
    : 0;
  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    secondsRef.current = secondsLeft;
  }, [secondsLeft]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    sentenceIndexRef.current = sentenceIndex;
  }, [sentenceIndex]);
  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.abort(); } catch { /* Already stopped. */ }
    }
    nativeSpeechActiveRef.current = false;
    if (Capacitor.isNativePlatform()) {
      void NativeSpeechRecognition.stopListening().catch(() => {});
    }
    const listeners = nativeSpeechListenersRef.current;
    nativeSpeechListenersRef.current = [];
    listeners.forEach((listener) => { void listener.remove().catch(() => {}); });
  }, []);
  const clearAudioContext = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => {});
    }
  }, []);
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    clearAudioContext();
  }, [clearAudioContext]);
  const stopRecording = useCallback(
    (discard = true) => {
      discardRef.current = discard;
      clearAudioContext();
      stopRecognition();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      } else {
        releaseStream();
      }
    },
    [clearAudioContext, releaseStream, stopRecognition],
  );
  const finishSession = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPhaseSafe("finished");
    setMessage("Your five-minute practice session is complete.");
    setErrorMessage("");
    window.speechSynthesis?.cancel();
    stopRecognition();
    if (recorderRef.current?.state === "recording") {
      stopRecording(false);
    } else {
      releaseStream();
    }
  }, [releaseStream, setPhaseSafe, stopRecording, stopRecognition]);
  useEffect(() => {
    finishSessionRef.current = finishSession;
  }, [finishSession]);
  useEffect(() => {
    if (phase !== "running") return;
    const interval = window.setInterval(() => {
      setSecondsLeft((previous) => Math.max(0, previous - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase]);
  useEffect(() => {
    if (secondsLeft === 0 && phase !== "setup" && phase !== "finished") {
      finishSessionRef.current();
    }
  }, [secondsLeft, phase]);
  const processAudio = useCallback(
    async (blob: Blob, sentence: string, startedAt: number, sessionId: number) => {
      if (processingRef.current || sessionId !== sessionIdRef.current) return;
      processingRef.current = true;
      setPhaseSafe(phaseRef.current === "finished" ? "finished" : "processing");
      setMessage("Checking your speech…");
      setErrorMessage("");
      const duration = Math.max(0, (Date.now() - startedAt) / 1000);
      try {
        if (!blob.size) {
          throw new Error("No audio was captured. Please try again.");
        }
        const formData = new FormData();
        const audioType = blob.type.toLowerCase();
        const extension = audioType.includes("mp4")
          ? "mp4"
          : audioType.includes("ogg")
            ? "ogg"
            : "webm";
        formData.append("audio", blob, `speaking-practice.${extension}`);
        formData.append("expected_text", sentence);
        const response = await fetch(API_URL, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(
            detail || `Transcription failed (HTTP ${response.status}).`,
          );
        }
        const data = await response.json();
        const heard = String(data.transcript ?? "").trim();
        if (sessionId !== sessionIdRef.current) return;
        if (!heard) {
          setTranscript("");
          setCurrentMatch(0);
          setFinalFeedback(null);
          setLiveWords("");
          setLiveTentative(false);
          setSpeakingTime(Number(duration.toFixed(1)));
          setMessage("No clear speech was detected. Try speaking a little louder.");
          setErrorMessage("This attempt was not added to your results.");
        } else {
          // Whisper is the authoritative transcript for the final colours and
          // the score; the browser's live text is not merged into it.
          const feedback = analyzeSpeech(sentence, heard, "final");
          const match = feedback.score;
          const attempt: Attempt = {
            sentence,
            transcript: heard,
            match,
            seconds: Number(duration.toFixed(1)),
            speed: speedRef.current,
          };
          setTranscript(heard);
          setFinalFeedback(feedback);
          setLiveWords("");
          setLiveTentative(false);
          setCurrentMatch(match);
          setSpeakingTime(attempt.seconds);
          setResults((previous) => [...previous, attempt]);
          setMessage("Speech checked. Moving to the next sentence shortly.");
          setErrorMessage("");
        }
        if (finishedRef.current || secondsRef.current <= 0) {
          finishSessionRef.current();
          return;
        }
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          processingRef.current = false;
          if (finishedRef.current || secondsRef.current <= 0) {
            finishSessionRef.current();
            return;
          }
          const nextIndex = sentenceIndexRef.current + 1;
          const bank = orderRef.current[speedRef.current];
          if (nextIndex >= bank.length) {
            orderRef.current[speedRef.current] = shuffled(sentenceBankRef.current[speedRef.current]);
            seenRef.current[speedRef.current].clear();
          }
          sentenceIndexRef.current = nextIndex;
          setSentenceIndex(nextIndex);
          setTranscript("");
          setLiveWords("");
          setFinalFeedback(null);
          setLiveTentative(false);
          setCurrentMatch(null);
          setSpeakingTime(null);
          setMessage("Read the new sentence aloud.");
          void startRecordingRef.current();
        }, FEEDBACK_MS);
      } catch (error) {
        if (sessionId !== sessionIdRef.current) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not check your speech. Check that the backend is running.",
        );
        setMessage("This attempt could not be checked. Resume to retry.");
        processingRef.current = false;
        if (!finishedRef.current && secondsRef.current > 0) {
          setPhaseSafe("paused");
        }
      } finally {
        releaseStream();
      }
    },
    [releaseStream, setPhaseSafe],
  );
  const startRecording = useCallback(async () => {
    if (finishedRef.current || secondsRef.current <= 0) return;
    if (recorderRef.current?.state === "recording") return;
    const sessionId = sessionIdRef.current;
    const sentence =
      orderRef.current[speedRef.current][
        sentenceIndexRef.current % orderRef.current[speedRef.current].length
      ];
    sentenceRef.current = sentence;
    chunksRef.current = [];
    speechStartedRef.current = 0;
    silenceStartedRef.current = 0;
    discardRef.current = false;
    committedLiveRef.current = "";
    sessionLiveRef.current = "";
    recognitionFatalRef.current = false;
    setLiveWords("");
    setLiveTentative(false);
    setLiveError("");
    setFinalFeedback(null);
    try {
      setErrorMessage("");
      setMessage("Listening… read the sentence aloud.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (
        sessionId !== sessionIdRef.current ||
        finishedRef.current ||
        secondsRef.current <= 0 ||
        phaseRef.current === "paused"
      ) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        const startedAt = startedAtRef.current;
        const discard = discardRef.current;
        discardRef.current = false;
        recorderRef.current = null;
        releaseStream();
        if (discard || sessionId !== sessionIdRef.current) return;
        void processAudio(blob, sentence, startedAt, sessionId);
      };
      // Native Android speech recognition is used inside the APK because
      // Android WebView does not reliably expose the browser SpeechRecognition API.
      if (Capacitor.isNativePlatform()) {
        recognitionSupportedRef.current = true;
        nativeSpeechActiveRef.current = true;
        try {
          const resultListener = await NativeSpeechRecognition.addListener(
            "speechResult",
            (event) => {
              if (!nativeSpeechActiveRef.current || !event.transcript?.trim()) return;
              const spoken = event.transcript.trim();
              if (event.isFinal) {
                // Native results are utterance-sized final segments. Append each
                // once; interim results are displayed separately and never stored.
                sessionLiveRef.current = [sessionLiveRef.current, spoken]
                  .filter(Boolean).join(" ");
                setLiveWords([committedLiveRef.current, sessionLiveRef.current]
                  .filter(Boolean).join(" "));
                setLiveTentative(false);
              } else {
                setLiveWords([committedLiveRef.current, sessionLiveRef.current, spoken]
                  .filter(Boolean).join(" "));
                setLiveTentative(true);
              }
            },
          );
          const errorListener = await NativeSpeechRecognition.addListener(
            "speechError",
            (event) => {
              if (!nativeSpeechActiveRef.current) return;
              setLiveError(
                `Android live speech recognition: ${event.message}. Your recording will still be checked by Whisper.`,
              );
            },
          );
          nativeSpeechListenersRef.current = [resultListener, errorListener];
          await NativeSpeechRecognition.startListening({ language: "en-IN" });
        } catch (error) {
          nativeSpeechActiveRef.current = false;
          recognitionSupportedRef.current = false;
          setLiveError(
            error instanceof Error
              ? `Android live recognition could not start: ${error.message}`
              : "Android live recognition could not start. Whisper will still check your recording.",
          );
        }
      } else {
        // Browser fallback for desktop/web builds.
        const recognitionWindow = window as RecognitionWindow;
        const RecognitionClass = recognitionWindow.SpeechRecognition ?? recognitionWindow.webkitSpeechRecognition;
        if (RecognitionClass) {
          recognitionSupportedRef.current = true;
          const recognition = new RecognitionClass();
          recognition.lang = "en-IN";
          recognition.continuous = true;
          recognition.interimResults = true;
          recognitionRef.current = recognition;
          let quickRestarts = 0;
          let lastStartAt = 0;
          recognition.onresult = (event) => {
            const parts: string[] = [];
            for (let i = 0; i < event.results.length; i++) {
              parts.push(event.results[i][0].transcript.trim());
            }
            const last = event.results[event.results.length - 1];
            sessionLiveRef.current = parts.filter(Boolean).join(" ");
            quickRestarts = 0;
            setLiveWords([committedLiveRef.current, sessionLiveRef.current].filter(Boolean).join(" "));
            setLiveTentative(!!last && !last.isFinal);
          };
          recognition.onerror = (event) => {
            const code = event?.error ?? "";
            if (code === "no-speech" || code === "aborted") return;
            recognitionFatalRef.current = true;
            setLiveError(`Live word feedback stopped${code ? ` (${code})` : ""}. Your recording will still be checked when you finish.`);
          };
          recognition.onend = () => {
            committedLiveRef.current = [committedLiveRef.current, sessionLiveRef.current].filter(Boolean).join(" ");
            sessionLiveRef.current = "";
            if (recognitionFatalRef.current) return;
            if (phaseRef.current === "running" && recorderRef.current === recorder) {
              quickRestarts = Date.now() - lastStartAt < 400 ? quickRestarts + 1 : 0;
              if (quickRestarts >= 5) {
                setLiveError("Live word feedback stopped. Your recording will still be checked when you finish.");
                return;
              }
              try { lastStartAt = Date.now(); recognition.start(); } catch { /* Browser blocked restart. */ }
            }
          };
          try { recognition.start(); } catch { recognitionSupportedRef.current = false; }
        } else {
          recognitionSupportedRef.current = false;
        }
      }
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const recordingStart = Date.now();
      recorder.start(250);
      setPhaseSafe("running");
      const detectSpeech = () => {
        if (
          recorderRef.current !== recorder ||
          recorder.state !== "recording" ||
          sessionId !== sessionIdRef.current
        ) {
          return;
        }
        const now = Date.now();
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
          sum += samples[i] * samples[i];
        }
        const rms = Math.sqrt(sum / samples.length);
        const voiceDetected = rms > SPEECH_THRESHOLD;
        if (voiceDetected) {
          if (!speechStartedRef.current) speechStartedRef.current = now;
          silenceStartedRef.current = 0;
        } else if (speechStartedRef.current) {
          if (!silenceStartedRef.current) silenceStartedRef.current = now;
          if (
            now - silenceStartedRef.current >= SILENCE_MS &&
            now - speechStartedRef.current >= MIN_SPEECH_MS
          ) {
            stopRecording(false);
            return;
          }
        }
        if (now - recordingStart >= MAX_RECORDING_MS) {
          stopRecording(false);
          return;
        }
        animationRef.current = requestAnimationFrame(detectSpeech);
      };
      animationRef.current = requestAnimationFrame(detectSpeech);
    } catch (error) {
      releaseStream();
      stopRecognition();
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Microphone access failed. Check your browser permissions.",
      );
      setMessage("Microphone could not start. Check permission and resume.");
      setPhaseSafe("paused");
    }
  }, [processAudio, releaseStream, setPhaseSafe, stopRecognition, stopRecording]);
  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);
  const handleStartPause = () => {
    if (phase === "setup") {
      sessionSavedRef.current = false;
      setSaveStatus("");
      finishedRef.current = false;
      processingRef.current = false;
      sessionIdRef.current += 1;
      seenRef.current[speed] = new Set();
      orderRef.current[speed] = shuffled(sentenceBankRef.current[speed]);
      const first = orderRef.current[speed][0];
      sentenceRef.current = first;
      setSentenceIndex(0);
      sentenceIndexRef.current = 0;
      setSecondsLeft(SESSION_SECONDS);
      secondsRef.current = SESSION_SECONDS;
      setResults([]);
      setTranscript("");
      setLiveWords("");
      setFinalFeedback(null);
      setLiveTentative(false);
      setLiveError("");
      setCurrentMatch(null);
      setSpeakingTime(null);
      setPhaseSafe("running");
      setMessage("Starting microphone…");
      void startRecordingRef.current();
      return;
    }
    if (phase === "finished" || phase === "processing") return;
    if (phase === "paused") {
      setPhaseSafe("running");
      setMessage("Resume reading the current sentence.");
      void startRecordingRef.current();
      return;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    processingRef.current = false;
    stopRecording(true);
    setPhaseSafe("paused");
    setMessage("Paused. Resume to try the current sentence again.");
  };
  const resetSession = () => {
    sessionSavedRef.current = false;
    setSaveStatus("");
    sessionIdRef.current += 1;
    finishedRef.current = false;
    processingRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopRecording(true);
    releaseStream();
    stopRecognition();
    window.speechSynthesis?.cancel();
    setSpeed("medium");
    speedRef.current = "medium";
    setPlaybackRate(1);
    setPlaybackPaused(false);
    setSecondsLeft(SESSION_SECONDS);
    secondsRef.current = SESSION_SECONDS;
    setSentenceIndex(0);
    sentenceIndexRef.current = 0;
    setResults([]);
    setTranscript("");
    setLiveWords("");
    setFinalFeedback(null);
    setLiveTentative(false);
    setLiveError("");
    setCurrentMatch(null);
    setSpeakingTime(null);
    setErrorMessage("");
    setMessage("Choose your speed, then press Start.");
    setPhaseSafe("setup");
    orderRef.current = {
      slow: shuffled(sentenceBankRef.current.slow),
      medium: shuffled(sentenceBankRef.current.medium),
      fast: shuffled(sentenceBankRef.current.fast),
    };
    seenRef.current = {
      slow: new Set(),
      medium: new Set(),
      fast: new Set(),
    };
  };
  const hearSentence = () => {
    if (!("speechSynthesis" in window)) {
      setErrorMessage("Text-to-speech is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentSentence);
    const voices = window.speechSynthesis.getVoices();
    const englishVoice =
      voices.find((voice) => voice.lang.toLowerCase() === "en-in") ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en-")) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
    if (englishVoice) utterance.voice = englishVoice;
    utterance.lang = englishVoice?.lang ?? "en-IN";
    utterance.rate = SPEED_DETAILS[speed].rate * playbackRate;
    utterance.pitch = 1;
    utterance.onend = () => setPlaybackPaused(false);
    window.speechSynthesis.speak(utterance);
    setPlaybackPaused(false);
  };
  const togglePlaybackPause = () => {
    if (!("speechSynthesis" in window)) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setPlaybackPaused(true);
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setPlaybackPaused(false);
    } else {
      hearSentence();
    }
  };
  useEffect(() => {
    return () => {
      sessionIdRef.current += 1;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      stopRecognition();
      releaseStream();
      window.speechSynthesis?.cancel();
    };
  }, [releaseStream, stopRecognition]);
  const isFinished = phase === "finished";

  useEffect(() => {
    const user = signedInUser;
    if (!isFinished || !user || sessionSavedRef.current) return;
    const userId = user.uid;

    if (results.length === 0) {
      setSaveStatus("No checked sentences to save.");
      return;
    }

    let cancelled = false;

    async function saveSession() {
      sessionSavedRef.current = true;
      setSaveStatus("Saving your session...");

      try {
        const missedWords = getSuggestions(results).missed;
        const average = Math.round(
          results.reduce((total, item) => total + item.match, 0) / results.length,
        );

        await addDoc(
          collection(db, "users", userId, "practiceSessions"),
          {
            activityType: "SpeakCheck",
            createdAt: serverTimestamp(),
            durationSeconds: SESSION_SECONDS - secondsLeft,
            selectedSpeed: speed,
            checkedSentences: results.length,
            averageMatch: average,
            results: results.map((item) => ({
              sentence: item.sentence,
              transcript: item.transcript,
              match: item.match,
              speakingSeconds: item.seconds,
              speed: item.speed,
            })),
            missedWords,
          },
        );

        if (!cancelled) setSaveStatus("Session saved successfully!");
      } catch (error) {
        sessionSavedRef.current = false;
        console.error("Failed to save SpeakCheck session:", error);
        if (!cancelled) {
          setSaveStatus(
            "Your session could not be saved. Check your connection and try again.",
          );
        }
      }
    }

    void saveSession();
    return () => {
      cancelled = true;
    };
  }, [isFinished, signedInUser, results, secondsLeft, speed]);

  const isSetup = phase === "setup";
  const isPaused = phase === "paused";
  const isProcessing = phase === "processing";
  const targetWords = words(currentSentence);
  // After Whisper answers, its result decides the colours. Before that, the
  // native Android or browser live text gives a provisional preview.
  const displayFeedback: SpeechFeedback =
    finalFeedback && finalFeedback.sentence === currentSentence
      ? finalFeedback
      : analyzeSpeech(currentSentence, liveWords, "live", liveTentative);
  const liveStatuses = displayFeedback.statuses;
  const currentWordIndex =
    displayFeedback === finalFeedback ? -1 : liveStatuses.indexOf("pending");
  const suggestions = getSuggestions(results);
  useEffect(() => {
  if (isFinished) {
    requestAnimationFrame(() => {
      resultsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }
}, [isFinished]);
  return (
    <main className="speakcheck-page min-h-[calc(100dvh-3.5rem)] overflow-x-hidden overflow-y-auto bg-transparent px-3 py-2 pb-28 text-slate-900 transition-colors dark:text-slate-100 sm:min-h-screen sm:h-auto sm:px-6 sm:py-8 sm:pb-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-2 sm:mb-8">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-600 sm:mb-2 sm:text-sm dark:text-emerald-300">
            TALKREADY AI
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
            SpeakCheck
          </h1>
          <p className="mt-1 hidden max-w-2xl text-xs leading-4 text-slate-600 dark:text-slate-400 sm:mt-2 sm:block sm:text-base sm:leading-6">
            Read fresh sentences aloud, follow live word feedback, and learn
            what to improve.
          </p>
        </header>
<section className="glass-panel animate-enter speakcheck-shell rounded-2xl p-2.5 sm:rounded-3xl sm:p-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-6 sm:gap-3">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Five-minute session</p>
              <p className="mt-0 font-mono text-3xl font-bold tabular-nums sm:mt-1 sm:text-5xl">
                {formatTime(secondsLeft)}
              </p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200">
              {isFinished
                ? "Completed"
                : isProcessing
                  ? "Checking speech"
                  : phase === "running"
                    ? "Listening"
                    : isPaused
                      ? "Paused"
                      : "Ready"}
            </span>
          </div>
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10 sm:mb-8 sm:h-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-400 transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          {isSetup && (
            <div className="mb-4 sm:mb-8">
              <h2 className="mb-2 text-base font-semibold sm:mb-3 sm:text-lg">Choose your pace</h2>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {(["slow", "medium", "fast"] as Speed[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSpeed(option)}
                    className={`flex min-h-[3rem] flex-col items-center justify-center rounded-xl border p-2 text-center transition sm:rounded-2xl sm:p-4 ${
                      speed === option
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-950 shadow-[0_8px_28px_rgba(139,92,246,0.14)] dark:border-emerald-300 dark:bg-emerald-400/15 dark:text-white"
                        : "border-slate-200 bg-white/55 text-slate-800 hover:border-emerald-300 hover:bg-white/85 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-100 dark:hover:border-emerald-300/40 dark:hover:bg-emerald-400/10"
                    }`}
                  >
                    <span className="block font-semibold">
                      {SPEED_DETAILS[option].title}
                    </span>
                    <span className="mt-1 hidden text-xs text-slate-600 dark:text-slate-400 sm:block">
                      {SPEED_DETAILS[option].target}
                    </span>
                    <span className="mt-1 hidden text-sm leading-5 text-slate-600 dark:text-slate-300 sm:mt-2 sm:block">
                      {SPEED_DETAILS[option].subtitle}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isFinished && (
<div className="glass-panel sentence-panel mb-2 rounded-xl p-2 sm:mb-6 sm:rounded-2xl sm:p-7">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Sentence {sentenceIndex + 1}
                </p>
<span className="rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-300/15 dark:bg-emerald-400/10 dark:text-emerald-200">
                  {SPEED_DETAILS[speed].title} pace
                </span>
              </div>
              <p className="flex flex-wrap gap-x-1 gap-y-0.5 text-base font-medium leading-snug sm:gap-x-2 sm:gap-y-2 sm:text-2xl sm:leading-relaxed">
                {targetWords.map((word, index) => {
                  const wordStatus = liveStatuses[index];
                  const heardWord = displayFeedback.heard[index];
                  const isCurrent = index === currentWordIndex && phase === "running";
                  const colorClass =
                    wordStatus === "correct"
                      ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
                      : wordStatus === "incorrect"
                        ? "bg-rose-500/10 text-rose-700 dark:bg-red-400/15 dark:text-red-300"
                        : wordStatus === "missed"
                          ? "bg-rose-500/10 text-rose-700 underline decoration-dotted decoration-rose-500/70 underline-offset-4 dark:bg-red-400/10 dark:text-red-300 dark:decoration-red-400/70"
                          : wordStatus === "pronunciation"
                            ? "bg-amber-500/10 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300"
                            : isCurrent
                              ? "bg-emerald-500/10 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200"
                              : "text-slate-800 dark:text-slate-100";
                  return (
                    <span
                      key={`${sentenceIndex}-${index}`}
                      className={`rounded-md px-1 transition-colors duration-200 ${colorClass}`}
                      title={
                        wordStatus === "correct"
                          ? "Word matched"
                          : wordStatus === "incorrect"
                            ? `Heard “${heardWord ?? ""}” instead`
                            : wordStatus === "missed"
                              ? "Not heard: this word was missed"
                              : wordStatus === "pronunciation"
                                ? `Heard “${heardWord ?? ""}”: possible word-ending, pronunciation or recognition difference`
                                : "Not checked yet"
                      }
                    >
                      {word}
                    </span>
                  );
                })}
              </p>
              <div className="mt-3 hidden flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400 sm:flex">
                <span className="rounded-lg border border-slate-200 bg-slate-100/80 px-2 py-1 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  Green: matched
                </span>
                <span className="rounded-lg border border-slate-200 bg-slate-100/80 px-2 py-1 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  Red: wrong or missed word
                </span>
                <span className="rounded-lg border border-slate-200 bg-slate-100/80 px-2 py-1 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  Orange: possible similar-sounding word
                </span>
                <span className="rounded-lg border border-slate-200 bg-slate-100/80 px-2 py-1 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  Plain: not reached yet
                </span>
              </div>
              {displayFeedback === finalFeedback &&
                displayFeedback.extras.length > 0 && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                    Extra words heard:{" "}
                    <span className="text-red-300">
                      {displayFeedback.extras.join(", ")}
                    </span>
                  </p>
                )}
              {transcript && currentMatch !== null && !isFinished && (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 sm:hidden">
                  <div>
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Sentence score</p>
                    <p className="text-xl font-bold leading-tight text-emerald-700 dark:text-emerald-300">{currentMatch}%</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Speaking time</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{speakingTime !== null ? `${speakingTime}s` : "—"}</p>
                  </div>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-5">
                <button
                  type="button"
                  onClick={hearSentence}
                  className="audio-control rounded-lg px-3 py-2 text-xs font-medium transition sm:rounded-xl sm:px-4 sm:text-sm"
                >
                  Hear sentence
                </button>
                <button
                  type="button"
                  onClick={togglePlaybackPause}
                  className="audio-control rounded-lg px-3 py-2 text-xs font-medium transition sm:rounded-xl sm:px-4 sm:text-sm"
                >
                  {playbackPaused ? "Resume audio" : "Pause audio"}
                </button>
                <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Playback speed
                  <select
                    value={playbackRate}
                    onChange={(event) =>
                      setPlaybackRate(Number(event.target.value))
                    }
                    className="rounded-xl border border-emerald-200/80 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none backdrop-blur-xl transition-all duration-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-100"
                  >
                    <option value={0.75}>0.75×</option>
                    <option value={1}>1×</option>
                    <option value={1.25}>1.25×</option>
                  </select>
                </label>
              </div>
              <p className="mt-2 text-xs leading-4 text-slate-600 dark:text-slate-400 sm:mt-4 sm:text-sm sm:leading-6">{message}</p>
              {dailySentencesLoading && (
                <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Loading today's practice sentences…
                </p>
              )}
              {!dailySentencesLoading && !dailySentencesError && (
                <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Today's practice pack is ready: 40% general, 15% about you, 20% IT, and 25% technical answers.
                </p>
              )}
              {dailySentencesError && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300" role="status">
                  {dailySentencesError} The built-in practice sentences will be used for this session.
                </p>
              )}
              {phase === "running" && (
                <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Read naturally, then pause briefly. The app will check your
                  recording and move to a new sentence automatically.
                </p>
              )}
              {phase === "running" && !recognitionSupportedRef.current && (
                <p className="mt-2 text-xs text-amber-300">
                  Live word recognition is unavailable in this browser. Your
                  final transcript will still be checked by the backend.
                </p>
              )}
              {liveError && (
                <p className="mt-2 text-xs text-amber-300">{liveError}</p>
              )}
              {liveWords && (
                <div className="glass-panel mt-4 rounded-xl p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Live speech detected
                  </p>
                  <p className="text-sm leading-6 text-slate-800 dark:text-slate-200">{liveWords}</p>
                </div>
              )}
            </div>
          )}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm leading-6 text-rose-800 dark:text-rose-200"
            >
              {errorMessage}
            </div>
          )}
          {(transcript || currentMatch !== null) && !isFinished && (
            <div
              ref={resultsSectionRef}
              className="mb-3 scroll-mt-2 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-3"
            >
              <div className="glass-panel min-w-0 rounded-xl p-3 sm:rounded-2xl sm:p-4">
                <p className="text-xs leading-4 text-slate-600 dark:text-slate-400 sm:text-sm">Word match</p>
                <p className="mt-1 text-2xl font-bold leading-tight text-emerald-700 dark:text-emerald-300 sm:text-3xl">
                  {currentMatch ?? "—"}
                  {currentMatch !== null ? "%" : ""}
                </p>
              </div>
              <div className="glass-panel min-w-0 rounded-xl p-3 sm:rounded-2xl sm:p-4">
                <p className="text-xs leading-4 text-slate-600 dark:text-slate-400 sm:text-sm">Speaking time</p>
                <p className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">
                  {speakingTime !== null ? `${speakingTime}s` : "—"}
                </p>
              </div>
              <div className="glass-panel col-span-2 min-w-0 rounded-xl p-3 sm:rounded-2xl sm:p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  What we heard
                </p>
                <p className="break-words text-sm leading-5 sm:text-base sm:leading-6">
                  {transcript || "No clear speech detected."}
                </p>
              </div>
            </div>
                        )}
          
{isFinished && (
  <div
    ref={resultsSectionRef}
    className="mb-2 space-y-3 scroll-mt-2 sm:mb-6 sm:space-y-5"
  >
    <div className="glass-panel rounded-2xl border-emerald-300/40 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-lime-400/10 p-3 sm:p-7">
      <p className="text-xs font-bold tracking-wide text-emerald-700 dark:text-emerald-300 sm:text-sm">
        SESSION SUMMARY
      </p>

      <h2 className="mt-1 text-xl font-bold sm:mt-2 sm:text-2xl">
        Well done!
      </h2>

      <p
        className="mt-1 text-xs text-slate-600 dark:text-slate-400 sm:mt-2 sm:text-sm"
        role="status"
        aria-live="polite"
      >
        {signedInUser
          ? saveStatus || "Preparing to save your session..."
          : "Sign in to save your practice history."}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400 sm:mt-2 sm:text-sm sm:leading-6">
        Here is your feedback for the words and speaking habits to practise next.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
        <div className="rounded-xl border border-slate-200/80 bg-white/50 p-2 dark:border-white/10 dark:bg-slate-950/50 sm:p-4">
          <p className="text-[11px] leading-4 text-slate-600 dark:text-slate-400 sm:text-sm">
            Checked sentences
          </p>
          <p className="mt-1 text-xl font-bold sm:text-3xl">
            {results.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white/50 p-2 dark:border-white/10 dark:bg-slate-950/50 sm:p-4">
          <p className="text-[11px] leading-4 text-slate-600 dark:text-slate-400 sm:text-sm">
            Average word match
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300 sm:text-3xl">
            {averageMatch}%
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white/50 p-2 dark:border-white/10 dark:bg-slate-950/50 sm:p-4">
          <p className="text-[11px] leading-4 text-slate-600 dark:text-slate-400 sm:text-sm">
            Time used
          </p>
          <p className="mt-1 text-lg font-bold sm:text-3xl">
            {formatTime(SESSION_SECONDS - secondsLeft)}
          </p>
        </div>
      </div>
    </div>

    <div className="glass-panel rounded-2xl p-3 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 sm:text-xs">
        YOUR PERSONAL FEEDBACK
      </p>

      <h3 className="mt-1 text-lg font-bold sm:mt-2 sm:text-xl">
        {suggestions.title}
      </h3>

      <ul className="mt-2 space-y-2 sm:mt-4 sm:space-y-3">
        {suggestions.items.map((item, index) => (
          <li
            key={index}
            className="flex gap-2 text-xs leading-5 text-slate-700 dark:text-slate-300 sm:gap-3 sm:text-sm sm:leading-6"
          >
            <span className="font-bold text-emerald-700 dark:text-emerald-300">
              {index + 1}.
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {suggestions.missed.length > 0 && (
        <div className="mt-3 sm:mt-5">
          <p className="mb-2 text-xs font-semibold text-slate-800 dark:text-slate-200 sm:text-sm">
            Words to practise
          </p>

          <div className="flex flex-wrap gap-2">
            {suggestions.missed.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => {
                  window.speechSynthesis?.cancel();
                  const utterance = new SpeechSynthesisUtterance(word);
                  utterance.lang = "en-IN";
                  utterance.rate = 0.75;
                  window.speechSynthesis?.speak(utterance);
                }}
                className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-2 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:hover:bg-emerald-400/20 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm"
                title={`Hear ${word}`}
              >
                {word} · Listen
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 hidden text-xs leading-5 text-slate-600 dark:text-slate-500 sm:mt-5 sm:block">
        Word match counts exact words (close words earn half credit) out of the sentence words plus any extra words. It is based on speech transcription and does not measure individual sounds or provide a verified pronunciation score.
      </p>
    </div>
  </div>
)}

          <div className="flex flex-row gap-2 sm:gap-3">
            {!isFinished && (
              <button
                type="button"
                onClick={handleStartPause}
                disabled={isProcessing || dailySentencesLoading}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:py-3.5 sm:text-base"
              >
                {isSetup ? "Start Session" : isPaused ? "Resume" : "Pause"}
              </button>
            )}
            <button
              type="button"
              onClick={resetSession}
              className="rounded-xl border border-slate-200 bg-white/60 px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-xl transition-all duration-300 hover:border-emerald-300 hover:bg-white/90 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 sm:px-5 sm:py-3.5 sm:text-base"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex-1 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:flex-none sm:px-5 sm:py-3.5"
            >
  Back to Home
</button>


          </div>
          <p className="mt-3 hidden text-xs leading-5 text-slate-600 dark:text-slate-500 sm:mt-5 sm:block">
            Live highlighting is a provisional preview from native Android or browser speech recognition.
            Final colours and word match come from your local Whisper backend. Microphone
            permission and backend connectivity are required.
          </p>
        </section>
      </div>
    </main>
  );
}