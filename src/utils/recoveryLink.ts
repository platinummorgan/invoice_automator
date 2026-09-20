export const RECOVERY_REDIRECT = 'com.invoiceautomator.app://auth/callback/recovery';

export function parseRecoveryLink(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'com.invoiceautomator.app:' || url.hostname !== 'auth' ||
      url.pathname !== '/callback/recovery') return null;
  const params = new URLSearchParams(url.hash.slice(1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (params.has('error') || url.searchParams.has('error') || params.get('type') !== 'recovery' || !accessToken || !refreshToken) {
    return { error: 'This reset link is invalid or expired. Request a new link from the sign-in screen.' };
  }
  return { accessToken, refreshToken };
}
