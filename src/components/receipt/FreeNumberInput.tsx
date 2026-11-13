'use client';

import React, { useState } from 'react';

export interface FreeNumberInputProps {
  value: number | null;
  onChangeNumber: (nextValue: number) => void;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Controlled numeric text box that never forces a minimum value or overwrites
 * partial digits while the user is typing. Validation/clamping only runs on blur.
 */
export const FreeNumberInput: React.FC<FreeNumberInputProps> = ({
  value,
  onChangeNumber,
  min,
  max,
  allowDecimal = false,
  step = allowDecimal ? 0.5 : 1,
  disabled = false,
  placeholder,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const externalText = value !== null && Number.isFinite(value) ? String(value) : '';

  const clampFinal = (num: number): number => {
    let next = num;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    return allowDecimal ? Math.round(next * 100) / 100 : Math.round(next);
  };

  const handleFocus = () => {
    setDraft(externalText);
    setIsFocused(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(',', '.');
    const pattern = allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
    if (!pattern.test(raw)) {
      return;
    }

    setDraft(raw);

    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }

    // Update live preview smoothly as soon as the number is in valid range,
    // without ever mutating what the user typed in `draft`.
    if ((min === undefined || parsed >= min) && (max === undefined || parsed <= max)) {
      onChangeNumber(allowDecimal ? parsed : Math.round(parsed));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const trimmed = draft.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = clampFinal(parsed);
    if (clamped !== value) {
      onChangeNumber(clamped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const base = Number.isFinite(Number(draft)) && draft.trim() !== '' ? Number(draft) : value ?? min ?? 0;
      const delta = e.key === 'ArrowUp' ? step : -step;
      const next = clampFinal(base + delta);
      setDraft(String(next));
      onChangeNumber(next);
    }
  };

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={isFocused ? draft : externalText}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );
};
