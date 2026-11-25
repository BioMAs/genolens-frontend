import AuthField from '@/components/auth/AuthField';

/** The field that takes the 6-digit code an authenticator app shows. */
export default function CodeField({
  id,
  value,
  readOnly,
  onChange,
}: {
  id: string;
  value: string;
  readOnly: boolean;
  onChange(value: string): void;
}) {
  return (
    <AuthField
      id={id}
      name="code"
      label="Authentication code"
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      required
      readOnly={readOnly}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="123 456"
    />
  );
}
