import { type ReactNode, useState } from "react";

interface TextFieldProps {
  label: string;
  type?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  step?: string;
  /** Replaces `hint` with an error message, styled to match, and wires up aria-invalid/aria-describedby. */
  error?: string;
  disabled?: boolean;
  /** Rendered at the opposite end of the label row — e.g. a live preview pill. */
  labelAddon?: ReactNode;
}

export function TextField({
  label,
  type = "text",
  name,
  value,
  onChange,
  required,
  autoComplete,
  placeholder,
  hint,
  step,
  error,
  disabled,
  labelAddon,
}: TextFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;
  const helperId = `${name}-helper`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-space-sm">
        <label htmlFor={name} className="font-label-lg text-label-lg text-on-surface">
          {label}
          {required && (
            <span className="text-error" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </label>
        {labelAddon}
      </div>
      <div className="relative">
        <input
          id={name}
          type={inputType}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          step={step}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? helperId : undefined}
          className={`w-full rounded-lg border bg-surface-container-lowest px-space-md py-space-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:outline-none disabled:opacity-60 ${
            error
              ? "border-error focus:border-error focus:ring-error/20"
              : "border-outline-variant focus:border-primary focus:ring-primary/20"
          } ${isPassword ? "pr-11" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-space-sm text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]">
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        )}
      </div>
      {error ? (
        <span id={helperId} role="alert" className="font-body-sm text-body-sm text-error">
          {error}
        </span>
      ) : (
        hint && (
          <span id={helperId} className="font-body-sm text-body-sm text-on-surface-variant">
            {hint}
          </span>
        )
      )}
    </div>
  );
}
