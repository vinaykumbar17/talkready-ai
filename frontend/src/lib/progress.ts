
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type PracticeSession = {
  sentence: string;
  transcript: string;
  wordMatch: number;
  speakingSeconds: number;
  speed: "slow" | "medium" | "fast";
};

export type SessionSentenceResult = {
  sentence: string;
  transcript: string;
  match: number;
  speakingSeconds: number;
  speed: "slow" | "medium" | "fast";
};

export type PracticeHistorySession = {
  id: string;
  createdAt: Date | null;
  durationSeconds: number;
  averageMatch: number;
  checkedSentences: number;
  selectedSpeed: "slow" | "medium" | "fast";
  results: SessionSentenceResult[];
};

export type ConversationHistoryReport = {
  id: string;
  createdAt: Date | null;
  scenario: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  voice: string;
  durationSeconds: number;
  overall: number | null;
  fluency: number;
  grammar: number;
  vocabulary: number;
  clarity: number;
  words: number;
  uniqueWords: number;
  fillers: number;
};

// Save a single practice entry using the original format.
export async function savePracticeSession(
  session: PracticeSession,
): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please log in to save your practice progress.");
  }

  const sessionsRef = collection(
    db,
    "users",
    user.uid,
    "practiceSessions",
  );

  const docRef = await addDoc(sessionsRef, {
    ...session,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

// Return ONE history entry for each Firestore document.
export async function getPracticeSessions(): Promise<
  PracticeHistorySession[]
> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please log in to view your practice history.");
  }

  const sessionsRef = collection(
    db,
    "users",
    user.uid,
    "practiceSessions",
  );

  const sessionsQuery = query(
    sessionsRef,
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(sessionsQuery);

  return snapshot.docs.map((document) => {
    const data = document.data();

    const rawResults: unknown[] = Array.isArray(data.results)
      ? data.results
      : [];

    const results: SessionSentenceResult[] = rawResults.map(
      (item: unknown) => {
        const result =
          item && typeof item === "object"
            ? (item as Record<string, unknown>)
            : {};

        const speed = result.speed;

        return {
          sentence: String(result.sentence ?? ""),
          transcript: String(result.transcript ?? ""),
          match: Number(result.match ?? 0),
          speakingSeconds: Number(
            result.seconds ?? result.speakingSeconds ?? 0,
          ),
          speed:
            speed === "slow" || speed === "fast"
              ? speed
              : "medium",
        };
      },
    );

    const isSpeakCheck = data.activityType === "SpeakCheck";

    // Support older documents that saved one sentence per document.
    const legacyResults: SessionSentenceResult[] =
      !isSpeakCheck && results.length === 0
        ? [
            {
              sentence: String(data.sentence ?? ""),
              transcript: String(data.transcript ?? ""),
              match: Number(data.wordMatch ?? 0),
              speakingSeconds: Number(data.speakingSeconds ?? 0),
              speed:
                data.speed === "slow" || data.speed === "fast"
                  ? data.speed
                  : "medium",
            },
          ].filter((result) => result.sentence || result.transcript)
        : [];

    const sessionResults = results.length > 0 ? results : legacyResults;

    const averageFromResults =
      sessionResults.length > 0
        ? Math.round(
            sessionResults.reduce(
              (total, result) => total + result.match,
              0,
            ) / sessionResults.length,
          )
        : 0;

    const rawAverage = Number(data.averageMatch);

    return {
      id: document.id,
      createdAt: data.createdAt?.toDate?.() ?? null,
      durationSeconds: Number(
        data.durationSeconds ??
          sessionResults.reduce(
            (total, result) => total + result.speakingSeconds,
            0,
          ),
      ),
      averageMatch: Number.isFinite(rawAverage)
        ? rawAverage
        : averageFromResults,
      checkedSentences: Number(
        data.checkedSentences ?? sessionResults.length,
      ),
      selectedSpeed:
        data.selectedSpeed === "slow" ||
        data.selectedSpeed === "fast"
          ? data.selectedSpeed
          : "medium",
      results: sessionResults,
    };
  });
}

// Return Before We Talk call reports only (no transcript or audio).
export async function getConversationReports(): Promise<
  ConversationHistoryReport[]
> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please log in to view your call reports.");
  }

  const reportsRef = collection(
    db,
    "users",
    user.uid,
    "conversationSessions",
  );

  const reportsQuery = query(
    reportsRef,
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(reportsQuery);

  return snapshot.docs.map((document) => {
    const data = document.data();

    const rawDifficulty = data.difficulty;

    return {
      id: document.id,
      createdAt: data.createdAt?.toDate?.() ?? null,
      scenario: String(data.scenario ?? ""),
      difficulty:
        rawDifficulty === "Beginner" ||
        rawDifficulty === "Advanced"
          ? rawDifficulty
          : "Intermediate",
      voice: String(data.voice ?? ""),
      durationSeconds: Number(data.durationSeconds ?? 0),
      overall:
        data.overall == null ? null : Number(data.overall),
      fluency: Number(data.fluency ?? 0),
      grammar: Number(data.grammar ?? 0),
      vocabulary: Number(data.vocabulary ?? 0),
      clarity: Number(data.clarity ?? 0),
      words: Number(data.words ?? 0),
      uniqueWords: Number(data.uniqueWords ?? 0),
      fillers: Number(data.fillers ?? 0),
    };
  });
}

// Delete all SpeakCheck sessions and Before We Talk reports for the current user.
export async function clearAllPracticeHistory(): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please log in to clear your practice history.");
  }

  const practiceRef = collection(
    db,
    "users",
    user.uid,
    "practiceSessions",
  );

  const conversationRef = collection(
    db,
    "users",
    user.uid,
    "conversationSessions",
  );

  const [practiceSnapshot, conversationSnapshot] = await Promise.all([
    getDocs(practiceRef),
    getDocs(conversationRef),
  ]);

  const documents = [
    ...practiceSnapshot.docs,
    ...conversationSnapshot.docs,
  ];

  // Firestore batches support a maximum of 500 operations.
  for (let index = 0; index < documents.length; index += 500) {
    const batch = writeBatch(db);
    const chunk = documents.slice(index, index + 500);

    chunk.forEach((document) => {
      batch.delete(document.ref);
    });

    await batch.commit();
  }
}