import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

export interface SimilarityFiltersValue {
  exclude_bibliography: boolean;
  exclude_quotes: boolean;
  exclude_citations: boolean;
  exclude_small_matches_words: number;
}

interface Props {
  value: SimilarityFiltersValue;
  onChange: (next: SimilarityFiltersValue) => void;
  disabled?: boolean;
  defaultOpen?: boolean;
}

export function SimilarityFiltersPanel({ value, onChange, disabled, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const update = (patch: Partial<SimilarityFiltersValue>) => onChange({ ...value, ...patch });

  return (
    <div className="border rounded-lg bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-medium">
          <Filter className="h-4 w-4 text-primary" />
          Similarity Filters (Optional)
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="rounded-md bg-muted/40 p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={value.exclude_bibliography}
                onCheckedChange={(c) => update({ exclude_bibliography: c === true })}
                disabled={disabled}
              />
              <span className="text-sm">Exclude Bibliography</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={value.exclude_quotes}
                onCheckedChange={(c) => update({ exclude_quotes: c === true })}
                disabled={disabled}
              />
              <span className="text-sm">Exclude Quotes</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={value.exclude_citations}
                onCheckedChange={(c) => update({ exclude_citations: c === true })}
                disabled={disabled}
              />
              <span className="text-sm">Exclude Cited Text</span>
            </label>

            <div className="pt-1">
              <Label className="text-sm">Exclude small matches (X words):</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={999}
                  value={value.exclude_small_matches_words}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    update({ exclude_small_matches_words: isNaN(n) || n < 0 ? 0 : Math.min(999, n) });
                  }}
                  disabled={disabled}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">words</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
