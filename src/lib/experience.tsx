import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Experience = "patients" | "research";

type Ctx = { experience: Experience; setExperience: (e: Experience) => void };

const ExperienceContext = createContext<Ctx | null>(null);
const KEY = "rarely-alone-experience";

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [experience, setExp] = useState<Experience>("research");

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "patients" || saved === "research") setExp(saved);
  }, []);

  const setExperience = (e: Experience) => {
    setExp(e);
    window.localStorage.setItem(KEY, e);
  };

  return (
    <ExperienceContext.Provider value={{ experience, setExperience }}>
      {children}
    </ExperienceContext.Provider>
  );
}

export function useExperience() {
  const ctx = useContext(ExperienceContext);
  if (!ctx) throw new Error("useExperience must be used inside ExperienceProvider");
  return ctx;
}
