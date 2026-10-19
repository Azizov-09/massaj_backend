export function normalizeHttpOrigin(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported frontend origin protocol: ${url.protocol}`);
  }
  return url.origin;
}

export function trustedFrontendOrigins(): string[] {
  const origins = new Set<string>();
  const addConfiguredOrigin = (value: string): void => {
    const origin = normalizeHttpOrigin(value);
    if (process.env.NODE_ENV === 'production' && !origin.startsWith('https://')) {
      throw new Error(`Production frontend origin must use HTTPS: ${origin}`);
    }
    origins.add(origin);
  };
  for (const value of (process.env.FRONTEND_ORIGINS ?? '').split(',')) {
    const origin = value.trim();
    if (origin) addConfiguredOrigin(origin);
  }
  if (process.env.FRONTEND_URL) addConfiguredOrigin(process.env.FRONTEND_URL);
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://localhost:3000');
  }
  return [...origins];
}

export function allowTrustedFrontendOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  if (!origin) {
    callback(null, true);
    return;
  }
  let normalized: string;
  try {
    normalized = normalizeHttpOrigin(origin);
  } catch {
    callback(new Error('Invalid request origin'));
    return;
  }
  if (trustedFrontendOrigins().includes(normalized)) {
    callback(null, true);
    return;
  }
  callback(new Error('Untrusted request origin'));
}

export function durationToMilliseconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error(`Unsupported duration "${value}"; use s, m, h, or d`);
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1_000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return amount * multiplier;
}
