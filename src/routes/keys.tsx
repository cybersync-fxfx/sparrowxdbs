import { createFileRoute } from "@tanstack/react-router";
import { SparrowxKeysEngine } from "@/components/SparrowxKeysEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/keys")({
  head: () => ({
    meta: [
      { title: "SparrowX Keys — 100% Offline Cryptographic Password Generator (Free, No Login)" },
      {
        name: "description",
        content:
          "Generate ultra-secure passwords, Diceware passphrases, and cryptographic tokens directly inside your browser. 100% client-side, zero server requests, and completely free.",
      },
      {
        name: "keywords",
        content:
          "offline password generator, client-side password tool, diceware passphrase generator, secure token generator, free password creator no login",
      },
      { property: "og:title", content: "SparrowX Keys — Offline Password & Secret Generator" },
      {
        property: "og:description",
        content:
          "High-entropy passwords and passphrases generated locally in your browser memory. Never sent to any server.",
      },
      { property: "og:url", content: "https://password.sparrowx.net" },
    ],
    links: [
      { rel: "canonical", href: "https://password.sparrowx.net" },
    ],
  }),
  component: SparrowxKeysRoute,
});

function SparrowxKeysRoute() {
  return (
    <>
      <SparrowxKeysEngine />
      <BackgroundEngineToaster />
    </>
  );
}
