import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btnPrimary, btnSecondary } from "./bits";

const REASONS = [
  "Link is broken",
  "Group seems unsafe or inappropriate",
  "Information is out of date",
  "Something else",
];

export function ReportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);

  const close = () => {
    onOpenChange(false);
    setReason("");
    setNote("");
    setError(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="bg-surface">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-primary">Report this link</DialogTitle>
          <DialogDescription>Tell us what's wrong so we can review it.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) return setError(true);
            toast("Thank you for keeping this space safe. We'll review it (simulated).");
            close();
          }}
          className="space-y-4"
        >
          <fieldset aria-describedby={error ? "report-error" : undefined}>
            <legend className="sr-only">Reason</legend>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label key={r} className="flex min-h-11 items-center gap-3">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => {
                      setReason(r);
                      setError(false);
                    }}
                    className="h-5 w-5 accent-[var(--primary)]"
                  />
                  {r}
                </label>
              ))}
            </div>
            {error && (
              <p id="report-error" role="alert" className="mt-2 text-sm text-destructive">
                Choose a reason to continue.
              </p>
            )}
          </fieldset>
          <label className="block">
            <span className="text-sm font-bold">Anything else we should know?</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-border p-3"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary}>
              Submit report
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
