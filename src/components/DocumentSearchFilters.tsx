import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, X, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface DocumentFilters {
  search: string;
  status: string;
  scanType?: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

interface DocumentSearchFiltersProps {
  filters: DocumentFilters;
  onFiltersChange: (filters: DocumentFilters) => void;
  showStatusFilter?: boolean;
  showScanTypeFilter?: boolean;
}

export const DocumentSearchFilters: React.FC<DocumentSearchFiltersProps> = ({
  filters,
  onFiltersChange,
  showStatusFilter = true,
  showScanTypeFilter = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status && filters.status !== 'all') count++;
    if (filters.scanType && filters.scanType !== 'all') count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    return count;
  }, [filters]);

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      status: 'all',
      scanType: 'all',
      dateFrom: undefined,
      dateTo: undefined
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by file name, customer email..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>
        <Button 
          variant="outline" 
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="icon" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="flex flex-wrap gap-3 p-4 rounded-lg border bg-muted/30">
          {showStatusFilter && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select 
                value={filters.status || 'all'} 
                onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showScanTypeFilter && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Scan Type</label>
              <Select 
                value={filters.scanType || 'all'} 
                onValueChange={(value) => onFiltersChange({ ...filters, scanType: value })}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Scan Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scan Types</SelectItem>
                  <SelectItem value="full">AI Scan</SelectItem>
                  <SelectItem value="similarity_only">Similarity Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !filters.dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? format(filters.dateFrom, "MMM dd") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => onFiltersChange({ ...filters, dateFrom: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !filters.dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? format(filters.dateTo, "MMM dd") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => onFiltersChange({ ...filters, dateTo: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to filter documents
export function filterDocuments<T extends { 
  file_name: string; 
  status: string; 
  uploaded_at: string;
  scan_type?: string;
  customer_profile?: { email?: string; full_name?: string | null } | null;
}>(documents: T[], filters: DocumentFilters): T[] {
  return documents.filter(doc => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesName = doc.file_name.toLowerCase().includes(searchLower);
      const matchesEmail = doc.customer_profile?.email?.toLowerCase().includes(searchLower) || false;
      const matchesFullName = doc.customer_profile?.full_name?.toLowerCase().includes(searchLower) || false;
      
      if (!matchesName && !matchesEmail && !matchesFullName) {
        return false;
      }
    }

    // Scan type filter
    if (filters.scanType && filters.scanType !== 'all' && doc.scan_type !== filters.scanType) {
      return false;
    }

    // Status filter
    if (filters.status && filters.status !== 'all' && doc.status !== filters.status) {
      return false;
    }

    // Date filters
    const uploadDate = new Date(doc.uploaded_at);
    if (filters.dateFrom && uploadDate < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo) {
      const endOfDay = new Date(filters.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (uploadDate > endOfDay) {
        return false;
      }
    }

    return true;
  });
}
