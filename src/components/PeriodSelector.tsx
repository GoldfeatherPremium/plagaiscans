import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

export type PeriodType = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

export interface DateRangeValue {
  start: Date;
  end: Date;
  periodType: PeriodType;
  label: string;
}

interface PeriodSelectorProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}

export const getDateRangeForPeriod = (period: PeriodType, customRange?: { from?: Date; to?: Date }): DateRangeValue => {
  const today = new Date();
  
  switch (period) {
    case 'today':
      return {
        start: startOfDay(today),
        end: endOfDay(today),
        periodType: 'today',
        label: 'Today'
      };
    case 'yesterday':
      const yesterday = subDays(today, 1);
      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
        periodType: 'yesterday',
        label: 'Yesterday'
      };
    case 'this_week':
      return {
        start: startOfWeek(today, { weekStartsOn: 1 }),
        end: endOfDay(today),
        periodType: 'this_week',
        label: 'This Week'
      };
    case 'last_week':
      const lastWeekStart = startOfWeek(subDays(today, 7), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subDays(today, 7), { weekStartsOn: 1 });
      return {
        start: lastWeekStart,
        end: endOfDay(lastWeekEnd),
        periodType: 'last_week',
        label: 'Last Week'
      };
    case 'this_month':
      return {
        start: startOfMonth(today),
        end: endOfDay(today),
        periodType: 'this_month',
        label: 'This Month'
      };
    case 'last_month':
      const lastMonth = subMonths(today, 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
        periodType: 'last_month',
        label: 'Last Month'
      };
    case 'custom':
      if (customRange?.from && customRange?.to) {
        return {
          start: startOfDay(customRange.from),
          end: endOfDay(customRange.to),
          periodType: 'custom',
          label: `${format(customRange.from, 'MMM d')} - ${format(customRange.to, 'MMM d')}`
        };
      }
      return getDateRangeForPeriod('today');
    default:
      return getDateRangeForPeriod('today');
  }
};

export function PeriodSelector({ value, onChange, className }: PeriodSelectorProps) {
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handlePeriodChange = (period: PeriodType) => {
    if (period === 'custom') {
      setIsCalendarOpen(true);
      return;
    }
    onChange(getDateRangeForPeriod(period));
  };

  const handleCustomDateSelect = (range: DateRange | undefined) => {
    setCustomDateRange(range);
    if (range?.from && range?.to) {
      onChange(getDateRangeForPeriod('custom', { from: range.from, to: range.to }));
      setIsCalendarOpen(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select 
        value={value.periodType} 
        onValueChange={(v) => handlePeriodChange(v as PeriodType)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="yesterday">Yesterday</SelectItem>
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="last_week">Last Week</SelectItem>
          <SelectItem value="this_month">This Month</SelectItem>
          <SelectItem value="last_month">Last Month</SelectItem>
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>

      {value.periodType === 'custom' && (
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {value.label}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={customDateRange}
              onSelect={handleCustomDateSelect}
              numberOfMonths={2}
              disabled={(date) => date > new Date()}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}
      
      {value.periodType !== 'custom' && (
        <span className="text-xs text-muted-foreground">
          {format(value.start, 'MMM d')} - {format(value.end, 'MMM d, yyyy')}
        </span>
      )}
    </div>
  );
}
