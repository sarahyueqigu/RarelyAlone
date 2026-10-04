import { useExperience, type Experience } from "@/lib/experience";

const OPTIONS: { value: Experience; label: string }[] = [
  { value: "patients", label: "Patients and families" },
  { value: "research", label: "Research and advocacy" },
];

export function ExperienceSwitcher({ fullWidth = false }: { fullWidth?: boolean }) {
  const { experience, setExperience } = useExperience();
  return (
    <div
      role="radiogroup"
      aria-label="Choose your experience"
      className={`inline-flex rounded-md border border-border bg-background p-1 ${fullWidth ? "w-full" : ""}`}
    >
      {OPTIONS.map((o) => {
        const active = experience === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setExperience(o.value)}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
              active ? "bg-tint font-bold text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
