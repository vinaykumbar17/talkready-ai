
import { SocialLogin } from "@capgo/capacitor-social-login";

const GOOGLE_WEB_CLIENT_ID =
  "591431734594-irfuouvdak6svhs9ubb1urbduoec1is8.apps.googleusercontent.com";

let initializationPromise: Promise<void> | null = null;

export function initializeSocialLogin(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = SocialLogin.initialize({
      google: {
        webClientId: GOOGLE_WEB_CLIENT_ID,
        mode: "online",
      },
    }).catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}
