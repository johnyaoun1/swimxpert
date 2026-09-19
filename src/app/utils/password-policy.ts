import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Min 8 chars, at least one uppercase letter and one digit. */
export function strongPasswordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');
    if (!value) return null; // let Validators.required handle empty
    if (value.length < 8) return { strongPassword: { reason: 'length' } };
    if (!/[A-Z]/.test(value)) return { strongPassword: { reason: 'upper' } };
    if (!/[0-9]/.test(value)) return { strongPassword: { reason: 'digit' } };
    return null;
  };
}

export function strongPasswordErrorMessage(errors: ValidationErrors | null | undefined): string {
  const reason = errors?.['strongPassword']?.reason;
  if (reason === 'upper') return 'Password must include at least one uppercase letter.';
  if (reason === 'digit') return 'Password must include at least one number.';
  return 'Password must be at least 8 characters, with 1 uppercase letter and 1 number.';
}
