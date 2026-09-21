export interface PhoneCountry {
  iso: string;
  name: string;
  dial: string;
}

/** Lebanon stays first. The rest are alphabetical. The API validates the number. */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'LB', name: 'Lebanon', dial: '+961' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { iso: 'AR', name: 'Argentina', dial: '+54' },
  { iso: 'AU', name: 'Australia', dial: '+61' },
  { iso: 'BE', name: 'Belgium', dial: '+32' },
  { iso: 'BR', name: 'Brazil', dial: '+55' },
  { iso: 'CA', name: 'Canada', dial: '+1' },
  { iso: 'CH', name: 'Switzerland', dial: '+41' },
  { iso: 'CY', name: 'Cyprus', dial: '+357' },
  { iso: 'DE', name: 'Germany', dial: '+49' },
  { iso: 'EG', name: 'Egypt', dial: '+20' },
  { iso: 'ES', name: 'Spain', dial: '+34' },
  { iso: 'FR', name: 'France', dial: '+33' },
  { iso: 'GB', name: 'United Kingdom', dial: '+44' },
  { iso: 'GR', name: 'Greece', dial: '+30' },
  { iso: 'IQ', name: 'Iraq', dial: '+964' },
  { iso: 'IT', name: 'Italy', dial: '+39' },
  { iso: 'JO', name: 'Jordan', dial: '+962' },
  { iso: 'KW', name: 'Kuwait', dial: '+965' },
  { iso: 'NL', name: 'Netherlands', dial: '+31' },
  { iso: 'QA', name: 'Qatar', dial: '+974' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '+966' },
  { iso: 'SE', name: 'Sweden', dial: '+46' },
  { iso: 'SY', name: 'Syria', dial: '+963' },
  { iso: 'TR', name: 'Turkey', dial: '+90' },
  { iso: 'US', name: 'United States', dial: '+1' }
];
