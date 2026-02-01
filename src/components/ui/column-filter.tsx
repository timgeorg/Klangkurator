import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Filter, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnFilterProps {
  title: string;
  type: 'text' | 'select' | 'range' | 'multiselect';
  value: any;
  onChange: (value: any) => void;
  options?: Array<{ label: string; value: any; color?: string }>;
  placeholder?: string;
  min?: number;
  max?: number;
}

export function ColumnFilter({ 
  title, 
  type, 
  value, 
  onChange, 
  options = [], 
  placeholder, 
  min, 
  max 
}: ColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState({ min: '', max: '' });

  // Reset tempRange when popover opens - use empty strings to indicate "no filter"
  useEffect(() => {
    if (isOpen && type === 'range') {
      setTempRange({
        min: value?.min !== undefined ? String(value.min) : '',
        max: value?.max !== undefined ? String(value.max) : ''
      });
    }
  }, [isOpen, type, value]);

  const hasActiveFilter = () => {
    if (type === 'text') return value && value.length > 0;
    if (type === 'select') return value !== null && value !== undefined;
    if (type === 'multiselect') return Array.isArray(value) && value.length > 0;
    if (type === 'range') return value?.min !== undefined || value?.max !== undefined;
    return false;
  };

  const clearFilter = () => {
    if (type === 'multiselect') {
      onChange([]);
    } else if (type === 'range') {
      onChange({});
      setTempRange({ min: '', max: '' });
    } else {
      onChange(null);
    }
  };

  const handleMultiselectChange = (optionValue: any, checked: boolean) => {
    const currentValues = Array.isArray(value) ? value : [];
    if (checked) {
      onChange([...currentValues, optionValue]);
    } else {
      onChange(currentValues.filter(v => v !== optionValue));
    }
  };

  const handleRangeApply = () => {
    const newRange: { min?: number; max?: number } = {};
    // Only set min/max if the user actually entered a value
    if (tempRange.min !== '' && !isNaN(Number(tempRange.min))) {
      newRange.min = Number(tempRange.min);
    }
    if (tempRange.max !== '' && !isNaN(Number(tempRange.max))) {
      newRange.max = Number(tempRange.max);
    }
    onChange(newRange);
    setIsOpen(false);
  };

  const getFilterDisplay = () => {
    if (!hasActiveFilter()) return null;
    
    if (type === 'text') return value;
    if (type === 'select') {
      const option = options.find(opt => opt.value === value);
      return option?.label || value;
    }
    if (type === 'multiselect') {
      return `${value.length} selected`;
    }
    if (type === 'range') {
      return `${value.min || min}-${value.max || max}`;
    }
    return null;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-5 w-5 p-0 hover:bg-table-row-hover",
            hasActiveFilter() && "text-primary"
          )}
        >
          <Filter className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{title}</h4>
            {hasActiveFilter() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilter}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          {hasActiveFilter() && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Current:</span>
              <Badge variant="secondary" className="text-xs">
                {getFilterDisplay()}
              </Badge>
            </div>
          )}

          <Separator />

          {type === 'text' && (
            <Input
              placeholder={placeholder || `Search ${title.toLowerCase()}...`}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="text-sm"
            />
          )}

          {type === 'select' && (
            <div className="space-y-2">
              {options.map((option) => (
                <Button
                  key={option.value}
                  variant={value === option.value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className="w-full justify-start text-sm"
                >
                  {value === option.value && <Check className="w-3 h-3 mr-2" />}
                  <div className="flex items-center gap-2">
                    {option.color && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    {option.label}
                  </div>
                </Button>
              ))}
            </div>
          )}

          {type === 'multiselect' && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {options.map((option) => {
                const isSelected = Array.isArray(value) && value.includes(option.value);
                return (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${title}-${option.value}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => 
                        handleMultiselectChange(option.value, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={`${title}-${option.value}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                    >
                      {option.color && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: option.color }}
                        />
                      )}
                      {option.label}
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          {type === 'range' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Min</label>
                  <Input
                    type="number"
                    value={tempRange.min}
                    onChange={(e) => setTempRange(prev => ({ ...prev, min: e.target.value }))}
                    placeholder={min !== undefined ? String(min) : 'No min'}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Max</label>
                  <Input
                    type="number"
                    value={tempRange.max}
                    onChange={(e) => setTempRange(prev => ({ ...prev, max: e.target.value }))}
                    placeholder={max !== undefined ? String(max) : 'No max'}
                    className="text-sm"
                  />
                </div>
              </div>
              <Button onClick={handleRangeApply} size="sm" className="w-full">
                Apply Range
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}