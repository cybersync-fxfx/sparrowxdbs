import { createFileRoute } from "@tanstack/react-router";
import { SparrowxKeysEngine } from "@/components/SparrowxKeysEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/keys")({
  head: () => ({
    meta: [
      { title: "SparrowX Keys | 100% Client-Side Cryptographic Engine" },
      {
        name: "description",
        content:
          "Zero server requests, pure Web Crypto API. Generate high-entropy passwords, Diceware passphrases, 512-bit JWT secrets, and salts offline.",
      },
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
