import { useId, useState } from 'react';
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
  const uid = useId();
  const idBib = `${uid}-bib`;
  const idQuotes = `${uid}-quotes`;
  const idCit = `${uid}-cit`;
  const idWords = `${uid}-words`;

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
            <div className="flex items-center gap-3">
              <Checkbox
                id={idBib}
                checked={value.exclude_bibliography}
                onCheckedChange={(c) => update({ exclude_bibliography: c === true })}
                disabled={disabled}
              />
              <Label htmlFor={idBib} className="text-sm cursor-pointer select-none">
                Exclude Bibliography
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id={idQuotes}
                checked={value.exclude_quotes}
                onCheckedChange={(c) => update({ exclude_quotes: c === true })}
                disabled={disabled}
              />
              <Label htmlFor={idQuotes} className="text-sm cursor-pointer select-none">
                Exclude Quotes
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id={idCit}
                checked={value.exclude_citations}
                onCheckedChange={(c) => update({ exclude_citations: c === true })}
                disabled={disabled}
              />
              <Label htmlFor={idCit} className="text-sm cursor-pointer select-none">
                Exclude Cited Text
              </Label>
            </div>

            <div className="pt-1">
              <Label htmlFor={idWords} className="text-sm">Exclude small matches (X words):</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  id={idWords}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  value={value.exclude_small_matches_words === 0 ? '' : value.exclude_small_matches_words}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      update({ exclude_small_matches_words: 0 });
                      return;
                    }
                    const n = parseInt(raw, 10);
                    update({ exclude_small_matches_words: isNaN(n) || n < 0 ? 0 : Math.min(999, n) });
                  }}
                  disabled={disabled}
                  className="w-24"
                  placeholder="0"
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
