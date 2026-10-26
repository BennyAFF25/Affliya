import { passwordRules } from '../utils/auth/credentials';
export default function PasswordRules({ password }: { password: string }) {
  const rules = passwordRules(password);
  return <ul className="mt-2 space-y-1 px-1 text-xs" aria-label="Password requirements" aria-live="polite">
    {([[rules.length, 'At least 8 characters'], [rules.number, 'At least one number']] as const).map(([met, label]) =>
      <li key={label} className={met ? 'text-[#00C2CB]' : 'text-white/55'}>{met ? '✓' : '○'} {label}<span className="sr-only">{met ? ': met' : ': not met'}</span></li>)}
  </ul>;
}
