import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { countries, Country, validatePhoneNumber } from '@/data/countries';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string, isValid: boolean) => void;
  disabled?: boolean;
  error?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({ value, onChange, disabled, error }) => {
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    countries.find(c => c.code === 'PK') || countries[0]
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [validationError, setValidationError] = useState('');

  // Extract phone number from value if it includes dial code
  React.useEffect(() => {
    if (value && value.startsWith(selectedCountry.dialCode)) {
      setPhoneNumber(value.slice(selectedCountry.dialCode.length));
    } else if (value && !value.startsWith('+')) {
      setPhoneNumber(value);
    }
  }, []);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setOpen(false);
    
    // Re-validate with new country
    if (phoneNumber) {
      const validation = validatePhoneNumber(phoneNumber, country);
      setValidationError(validation.valid ? '' : validation.message);
      onChange(`${country.dialCode}${phoneNumber}`, validation.valid);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.replace(/\D/g, '');
    const limitedValue = inputValue.slice(0, selectedCountry.maxLength);
    
    setPhoneNumber(limitedValue);
    
    if (limitedValue) {
      const validation = validatePhoneNumber(limitedValue, selectedCountry);
      setValidationError(validation.valid ? '' : validation.message);
      onChange(`${selectedCountry.dialCode}${limitedValue}`, validation.valid);
    } else {
      setValidationError('');
      onChange('', false);
    }
  };

  const sortedCountries = useMemo(() => {
    return [...countries].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="w-[140px] justify-between px-3 font-normal"
            >
              <span className="truncate">
                {selectedCountry.dialCode} ({selectedCountry.code})
              </span>
              <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0 bg-background border z-50" align="start">
            <Command>
              <CommandInput placeholder="Search country..." />
              <CommandList>
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-auto">
                  {sortedCountries.map((country) => (
                    <CommandItem
                      key={country.code}
                      value={`${country.name} ${country.dialCode}`}
                      onSelect={() => handleCountrySelect(country)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedCountry.code === country.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1 truncate">{country.name}</span>
                      <span className="text-muted-foreground ml-2">{country.dialCode}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        
        <Input
          type="tel"
          placeholder="Enter phone number"
          value={phoneNumber}
          onChange={handlePhoneChange}
          disabled={disabled}
          className="flex-1"
          maxLength={selectedCountry.maxLength}
        />
      </div>
      
      <p className="text-xs text-muted-foreground">
        {selectedCountry.name}: {selectedCountry.minLength === selectedCountry.maxLength 
          ? `${selectedCountry.minLength} digits required`
          : `${selectedCountry.minLength}-${selectedCountry.maxLength} digits`
        }
      </p>
      
      {(validationError || error) && (
        <p className="text-sm text-destructive">{validationError || error}</p>
      )}
    </div>
  );
};
