/**
 * The demo is a sandbox inside the live app. Demo accounts (isDemo) only ever see and touch other demo accounts:
 * a demo admin can't see or act on real sign-ups, and a demo coach or admin can't pull a real person in by email
 * or create an account at a real address. People added from the demo are demo accounts too.
 */
export function isDemoAddress(email: string) {
  return /@demo\.bothhands\.app$/i.test(email) || /@example\.(com|org|net)$/i.test(email) || /\.(test|example)$/i.test(email);
}

export const DEMO_ADDRESS_NOTE = "In the demo, use a made-up address, like sam@demo.bothhands.app.";
