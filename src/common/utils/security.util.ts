export function assertPasswordPolicy(password: string): void {
  if (password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error('Password must be 12-128 characters and include upper-case, lower-case, and a number');
  }
}
