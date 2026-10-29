const usernameKey = 'tred-admin-remembered-username';

export function rememberedUsername(): string {
  try { return localStorage.getItem(usernameKey) || ''; } catch { return ''; }
}

/** Store only the username locally; password storage belongs to the browser. */
export function rememberLogin(identifier: string, password: string, remember: boolean): void {
  try { if (remember) localStorage.setItem(usernameKey, identifier); else localStorage.removeItem(usernameKey); } catch { /* Storage can be disabled by the browser. */ }
  if (!remember || !window.isSecureContext || !navigator.credentials?.store) return;
  const PasswordCredential = (window as Window & { PasswordCredential?: new (data: { id: string; password: string }) => Credential }).PasswordCredential;
  if (!PasswordCredential) return;
  try {
    const credential = new PasswordCredential({ id: identifier, password });
    void navigator.credentials.store(credential).catch(() => { /* The user or browser may decline storage. */ });
  } catch { /* Password managers are optional and vary by browser. */ }
}
