import { normalizeUzbekPhone } from './phone.util';
describe('normalizeUzbekPhone', () => {
  it.each([['+998 90 123-45-67', '+998901234567'], ['998901234567', '+998901234567'], ['90 123 45 67', '+998901234567']])('normalizes %s', (input, expected) => { expect(normalizeUzbekPhone(input)).toBe(expected); });
  it('rejects malformed values', () => { expect(() => normalizeUzbekPhone('123')).toThrow('Phone must be a valid Uzbekistan phone number'); });
});
