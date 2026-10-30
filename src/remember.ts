const usernameKey = 'tred-admin-remembered-username';
type BrowserPasswordCredential = Credential & { password?: string; name?: string };

const passwordCredentialConstructor = () => (window as Window & { PasswordCredential?: new (data: { id: string; name: string; password: string }) => Credential }).PasswordCredential;

export function rememberedUsername(): string {
  try { return localStorage.getItem(usernameKey) || ''; } catch { return ''; }
}

/** Store only the username locally; password storage belongs to the browser. */
export async function browserRememberedLogin(): Promise<{ identifier: string; password: string } | null> {
  if (!window.isSecureContext || !navigator.credentials?.get) return null;
  try {
    const credential = await navigator.credentials.get({ password: true, mediation: 'optional' } as CredentialRequestOptions) as BrowserPasswordCredential | null;
    if (!credential?.id || !credential.password) return null;
    return { identifier: credential.id, password: credential.password };
  } catch { return null; }
}

/** Store only the username locally; the password is handed to the browser password manager. */
export async function rememberLogin(identifier: string, password: string, remember: boolean): Promise<boolean> {
  try { if (remember) localStorage.setItem(usernameKey, identifier); else localStorage.removeItem(usernameKey); } catch { /* Storage can be disabled by the browser. */ }
  if (!remember || !window.isSecureContext || !navigator.credentials?.store) return false;
  const PasswordCredential = passwordCredentialConstructor();
  if (!PasswordCredential) return false;
  try {
    const credential = new PasswordCredential({ id: identifier, name: identifier, password });
    await navigator.credentials.store(credential);
    return true;
  } catch { return false; }
}
