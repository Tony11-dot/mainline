import { Capacitor, registerPlugin } from '@capacitor/core';

/** iOS sign-in plugin (apps/mobile/ios/App/App/NativeChrome/AuthPlugin.swift). */
interface AuthPlugin {
  /** OAuth in ASWebAuthenticationSession; resolves with the callback URL. Rejects with code 'cancelled' if closed. */
  webAuth(o: { url: string; callbackScheme: string }): Promise<{ url: string }>;
  /** Sign in with Apple; `nonce` is sha256(raw nonce) as hex, echoed back inside the identity token. */
  appleSignIn(o: { nonce: string }): Promise<{ identityToken: string; name: string }>;
}

const Auth = registerPlugin<AuthPlugin>('Auth');

export const hasNativeAuth = () => Capacitor.getPlatform() === 'ios';

export const isCancelled = (e: unknown) => (e as { code?: string } | undefined)?.code === 'cancelled';

export const nativeWebAuth = (url: string, callbackScheme: string) => Auth.webAuth({ url, callbackScheme }).then((r) => r.url);

export const nativeAppleSignIn = (nonce: string) => Auth.appleSignIn({ nonce });
