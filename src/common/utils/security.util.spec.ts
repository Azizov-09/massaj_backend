import { assertPasswordPolicy } from './security.util';
describe('assertPasswordPolicy', () => { it('accepts a strong password', () => expect(() => assertPasswordPolicy('SafePassword123')).not.toThrow()); it.each(['short1A', 'alllowercase123', 'ALLUPPERCASE123', 'NoNumbersHere'])('rejects weak password %s', (password) => expect(() => assertPasswordPolicy(password)).toThrow()); });
