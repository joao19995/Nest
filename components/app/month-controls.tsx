import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MonthControls({
  currentLabel,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  currentLabel: string;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="icon" onClick={onPrev} aria-label={prevLabel}>
        <ChevronLeft size={18} aria-hidden="true" />
      </Button>
      <span className="rounded-lg bg-ink px-3.5 py-2.5 text-xs font-bold tracking-wide text-white shadow-[0_4px_12px_rgb(23_55_45/25%)]">{currentLabel}</span>
      <Button variant="secondary" size="icon" onClick={onNext} aria-label={nextLabel}>
        <ChevronRight size={18} aria-hidden="true" />
      </Button>
    </div>
  );
}
