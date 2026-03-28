"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Value while editing: empty string is allowed between keystrokes. */
export type NumericInputValue = number | "";

/** Normalizes RHF + Zod `number | "" | unknown` values for controlled display. */
export function toNumericInputValue(value: unknown): NumericInputValue {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value === "") {
    return "";
  }
  return "";
}

export interface NumericInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> {
  value: NumericInputValue;
  onChange: (value: NumericInputValue) => void;
  /** `decimal` allows one `.`; `integer` is digits-only (no fractions). */
  variant?: "decimal" | "integer";
  /**
   * For `variant="decimal"`, max digits after `.` (e.g. `2` for USD). Use `0`
   * for whole numbers only. When omitted, any fraction length is allowed.
   */
  maxFractionDigits?: number;
}

/**
 * Whole numbers only: digits before the first `.` / `e` / `,` (paste-safe).
 */
function parseIntegerDigitsRaw(raw: string): NumericInputValue {
  const trimmed = raw.trim().replaceAll(",", ".");
  if (trimmed === "") {
    return "";
  }
  const head = trimmed.split(/[.eE]/)[0];
  const digits = head.replace(/\D/g, "");
  if (digits === "") {
    return "";
  }
  const n = Number.parseInt(digits, 10);
  return Number.isNaN(n) ? "" : n;
}

/**
 * Keeps a single `.` and optional fraction; used while the field is focused so
 * `12.` is not collapsed to `12` in the DOM.
 */
function sanitizeDecimalString(
  raw: string,
  maxFractionDigits?: number,
): string {
  const t = raw.replaceAll(",", ".");
  const neg = t.startsWith("-");
  const body = neg ? t.slice(1) : t;

  let intPart = "";
  let fracPart = "";
  let dotSeen = false;

  for (const c of body) {
    if (c >= "0" && c <= "9") {
      if (!dotSeen) {
        intPart += c;
      } else if (
        maxFractionDigits === undefined ||
        fracPart.length < maxFractionDigits
      ) {
        fracPart += c;
      }
    } else if (c === "." && !dotSeen) {
      dotSeen = true;
    }
  }

  if (intPart === "" && fracPart === "" && !dotSeen) {
    return neg ? "-" : "";
  }

  const intShow =
    intPart === "" && (fracPart !== "" || dotSeen) ? "0" : intPart;
  const core = intShow + (dotSeen ? `.${fracPart}` : "");

  return (neg ? "-" : "") + core;
}

/**
 * Maps draft text to form state (number or empty). Trailing `.` still yields a
 * number so RHF/Zod see a valid interim value.
 */
function decimalDraftToFormValue(draft: string): NumericInputValue {
  const t = draft.trim().replaceAll(",", ".");
  if (t === "" || t === "-" || t === ".") {
    return "";
  }
  const withoutTrailingDot = t.endsWith(".") ? t.slice(0, -1) : t;
  if (withoutTrailingDot === "" || withoutTrailingDot === "-") {
    return "";
  }
  const n = Number.parseFloat(withoutTrailingDot);
  return Number.isNaN(n) ? "" : n;
}

function blockIntegerNonDigitKeys(
  event: React.KeyboardEvent<HTMLInputElement>,
) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  const blocked = new Set([".", ",", "e", "E", "+", "-", " "]);
  if (blocked.has(event.key)) {
    event.preventDefault();
  }
}

/**
 * Text-based numeric input so users can clear the field and type a new value
 * (native `type="number"` plus `parseFloat(x) || 0` prevents an empty state).
 *
 * Decimal mode uses a focus-time string draft so values like `12.` are not
 * lost when the parent stores a number.
 */
export function NumericInput({
  className,
  value,
  onChange,
  variant = "decimal",
  maxFractionDigits,
  onKeyDown,
  onFocus,
  onBlur,
  ...props
}: NumericInputProps) {
  const [decimalDraft, setDecimalDraft] = React.useState<string | null>(null);

  const display =
    variant === "decimal" && decimalDraft !== null
      ? decimalDraft
      : value === ""
        ? ""
        : String(value);

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    if (variant === "decimal") {
      setDecimalDraft(value === "" ? "" : String(value));
    }
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (variant === "decimal") {
      setDecimalDraft(null);
    }
    onBlur?.(event);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;

    if (raw.trim() === "") {
      if (variant === "decimal") {
        setDecimalDraft("");
      }
      onChange("");
      return;
    }

    if (variant === "integer") {
      onChange(parseIntegerDigitsRaw(raw));
      return;
    }

    if (maxFractionDigits === 0) {
      onChange(parseIntegerDigitsRaw(raw));
      return;
    }

    const draft = sanitizeDecimalString(raw, maxFractionDigits);
    setDecimalDraft(draft);
    onChange(decimalDraftToFormValue(draft));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (variant === "integer") {
      blockIntegerNonDigitKeys(event);
    }
    onKeyDown?.(event);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode={variant === "integer" ? "numeric" : "decimal"}
      autoComplete="off"
      pattern={variant === "integer" ? "[0-9]*" : undefined}
      className={cn(className)}
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
