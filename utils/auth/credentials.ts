export const USERNAME_HINT = '3–24 letters, numbers, . _ -';
export const validUsername = (value: string) => /^[A-Za-z0-9._-]{3,24}$/.test(value);
export const PASSWORD_ERROR = 'Password must be at least 8 characters and include at least one number.';
export function passwordRules(value: string) {
  return { length: value.length >= 8, number: /[0-9]/.test(value) };
}
export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && Object.values(passwordRules(value)).every(Boolean);
}
