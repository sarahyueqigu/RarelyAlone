import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  DEFAULT_CONDITION,
  seedExperience,
  seedInquiries,
  type Challenge,
  type ConditionId,
  type Inquiry,
  type SharedExperience,
} from "@/data/community";

export type SavedKind = "community" | "researcher" | "organization";
export interface SavedItem {
  kind: SavedKind;
  id: string;
  name: string;
}
export interface BringQuestion {
  id: string;
  communityId: string;
  communityName: string;
  text: string;
}

interface CommunityState {
  condition: ConditionId;
  setCondition: (c: ConditionId) => void;
  saved: SavedItem[];
  isSaved: (id: string) => boolean;
  toggleSaved: (item: SavedItem) => void;
  inquiries: Inquiry[];
  sentIds: string[];
  addInquiry: (i: Inquiry) => void;
  markHandled: (id: string) => void;
  highlightInquiryId: string | null;
  challenges: Challenge[];
  setChallenges: (c: Challenge[]) => void;
  questions: BringQuestion[];
  addQuestion: (q: BringQuestion) => void;
  removeQuestion: (id: string) => void;
  experience: SharedExperience | null;
  setExperience: (e: SharedExperience | null) => void;
  milestone: boolean;
  dismissMilestone: () => void;
  hintDismissed: boolean;
  dismissHint: () => void;
  everSaved: boolean;
  reminders: string[];
  toggleReminder: (id: string) => void;
}

const Ctx = createContext<CommunityState | null>(null);
const K = {
  condition: "ra-condition-v2",
  reminders: "ra-reminders",
  saved: "ra-saved",
  inquiries: "ra-inquiries",
  sent: "ra-sent",
  challenges: "ra-challenges",
  questions: "ra-questions",
  experience: "ra-experience",
  everSaved: "ra-ever-saved",
  hint: "ra-hint-dismissed",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function CommunityProvider({ children }: { children: ReactNode }) {
  const [condition, setCondition] = useState<ConditionId>(DEFAULT_CONDITION);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>(seedInquiries);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [highlightInquiryId, setHighlight] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [questions, setQuestions] = useState<BringQuestion[]>([]);
  const [experience, setExperience] = useState<SharedExperience | null>(seedExperience);
  const [everSaved, setEverSaved] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [milestone, setMilestone] = useState(false);
  const [reminders, setReminders] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCondition(read<ConditionId>(K.condition, DEFAULT_CONDITION));
    setReminders(read<string[]>(K.reminders, []));
    setSaved(read(K.saved, []));
    setInquiries(read(K.inquiries, seedInquiries));
    setSentIds(read(K.sent, []));
    setChallenges(read(K.challenges, []));
    setQuestions(read(K.questions, []));
    setExperience(read<SharedExperience | null>(K.experience, seedExperience));
    setEverSaved(read(K.everSaved, false));
    setHintDismissed(read(K.hint, false));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    write(K.condition, condition);
    write(K.saved, saved);
    write(K.inquiries, inquiries);
    write(K.sent, sentIds);
    write(K.challenges, challenges);
    write(K.questions, questions);
    write(K.experience, experience);
    write(K.everSaved, everSaved);
    write(K.hint, hintDismissed);
    write(K.reminders, reminders);
  }, [loaded, reminders, condition, saved, inquiries, sentIds, challenges, questions, experience, everSaved, hintDismissed]);

  const isSaved = useCallback((id: string) => saved.some((s) => s.id === id), [saved]);

  const toggleSaved = (item: SavedItem) => {
    if (saved.some((s) => s.id === item.id)) {
      setSaved((p) => p.filter((s) => s.id !== item.id));
      toast(`Removed ${item.name} from your circle.`);
    } else {
      setSaved((p) => [...p, item]);
      toast(item.kind === "community" ? "Added to your circle." : `Saved ${item.name}.`);
      if (!everSaved && item.kind === "community") {
        setEverSaved(true);
        setMilestone(true);
      }
    }
  };

  const addInquiry = (i: Inquiry) => {
    setInquiries((p) => [i, ...p]);
    setSentIds((p) => [i.id, ...p]);
    setHighlight(i.id);
  };

  const markHandled = (id: string) =>
    setInquiries((p) => p.map((i) => (i.id === id ? { ...i, status: "handled" } : i)));

  return (
    <Ctx.Provider
      value={{
        condition,
        setCondition,
        saved,
        isSaved,
        toggleSaved,
        inquiries,
        sentIds,
        addInquiry,
        markHandled,
        highlightInquiryId,
        challenges,
        setChallenges,
        questions,
        addQuestion: (q) => setQuestions((p) => [...p, q]),
        removeQuestion: (id) => setQuestions((p) => p.filter((q) => q.id !== id)),
        experience,
        setExperience,
        milestone,
        dismissMilestone: () => setMilestone(false),
        hintDismissed,
        dismissHint: () => setHintDismissed(true),
        everSaved,
        reminders,
        toggleReminder: (id) => {
          const on = reminders.includes(id);
          setReminders((p) => (on ? p.filter((x) => x !== id) : [...p, id]));
          toast(on ? "Reminder removed." : "Reminder saved on this device (simulated).");
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCommunity() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCommunity must be used inside CommunityProvider");
  return c;
}
