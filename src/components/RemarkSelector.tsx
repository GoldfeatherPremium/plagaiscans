import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useRemarkPresets } from '@/hooks/useRemarkPresets';

interface RemarkSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  labelClassName?: string;
  rows?: number;
  compact?: boolean;
}

export const RemarkSelector: React.FC<RemarkSelectorProps> = ({
  value,
  onChange,
  label = 'Remarks (Optional)',
  labelClassName,
  rows = 3,
  compact = false,
}) => {
  const { presets, loading } = useRemarkPresets(true);
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');

  // On mount, determine if current value matches a preset or is custom
  useEffect(() => {
    if (!value) {
      setMode('preset');
      return;
    }
    const isPreset = presets.some(p => p.remark_text === value);
    setMode(isPreset ? 'preset' : 'custom');
  }, [presets]);

  const handleSelectChange = (selected: string) => {
    if (selected === '__custom__') {
      setMode('custom');
      onChange('');
    } else if (selected === '__none__') {
      setMode('preset');
      onChange('');
    } else {
      setMode('preset');
      onChange(selected);
    }
  };

  const selectValue = mode === 'custom' ? '__custom__' : (value || '__none__');

  return (
    <div className="space-y-2">
      <Label className={labelClassName}>{label}</Label>
      <Select value={selectValue} onValueChange={handleSelectChange}>
        <SelectTrigger className={compact ? "h-9 text-xs" : ""}>
          <SelectValue placeholder={loading ? "Loading..." : "Select a remark..."} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">No remark</SelectItem>
          {presets.map((preset) => (
            <SelectItem key={preset.id} value={preset.remark_text}>
              {preset.remark_text}
            </SelectItem>
          ))}
          <SelectItem value="__custom__">✏️ Custom remark...</SelectItem>
        </SelectContent>
      </Select>
      {mode === 'custom' && (
        <Textarea
          placeholder="Type a custom remark..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={compact ? 2 : rows}
          className={compact ? "text-xs" : ""}
        />
      )}
    </div>
  );
};
