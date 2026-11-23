import "@testing-library/jest-dom/vitest";

if (typeof process !== "undefined" && process.env) {
  process.env.GOOGLE_CLIENT_ID =
    process.env.GOOGLE_CLIENT_ID || "test-client-id.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET =
    process.env.GOOGLE_CLIENT_SECRET || "test-client-secret-long-enough-12345";
  process.env.GEMINI_API_KEY =
    process.env.GEMINI_API_KEY || "AIzaSyTestBrainApiKeyPlaceholderForTests";
}

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
