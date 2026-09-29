export function normalizeUzbekPhone(input: string): string {
  const digits = input.trim().replace(/[\s()-]/g, '').replace(/^\+/, '');
  const national = digits.startsWith('998') ? digits : `998${digits.replace(/^0/, '')}`;
  if (!/^998\d{9}$/.test(national)) throw new Error('Phone must be a valid Uzbekistan phone number');
  return `+${national}`;
}
