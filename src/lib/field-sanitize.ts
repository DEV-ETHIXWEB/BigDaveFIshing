import type { FormEvent } from 'react';

/**
 * Rewrites a field's own value as it is typed, so disallowed characters never appear.
 *
 * Cleaning only at submit time lets someone type letters into a phone box, watch them sit
 * there, and then get an error about something they had no idea was wrong. This removes
 * them on the keystroke instead.
 *
 * Lived in WaiverForm.tsx until the booking forms needed the same behaviour, the phone
 * rule they share is digits-only, and a visitor typing "(503) 538-5607" into a lead form
 * and being told off for it is a booking lost to a validation message.
 */
export const sanitize =
  (clean: (value: string) => string) => (event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const next = clean(input.value);
    if (next !== input.value) {
      // Keep the caret where it was rather than throwing it to the end, or typing in
      // the middle of an already-filled field becomes unusable.
      const dropped = input.value.length - next.length;
      const caret = Math.max(0, (input.selectionStart ?? next.length) - dropped);
      input.value = next;
      input.setSelectionRange(caret, caret);
    }
  };
