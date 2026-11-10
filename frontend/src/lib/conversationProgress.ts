
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type ConversationReport = {
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

export async function saveConversationReport(
  report: ConversationReport,
): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please log in to save your call report.");
  }

  const reportsRef = collection(
    db,
    "users",
    user.uid,
    "conversationSessions",
  );

  const document = await addDoc(reportsRef, {
    ...report,
    createdAt: serverTimestamp(),
  });

  return document.id;
}
