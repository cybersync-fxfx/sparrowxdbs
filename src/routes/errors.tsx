import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy/short alias for `/docs/errors` (referenced by footer links & external bookmarks).
 * Redirects immediately while preserving `?code=...&ref=...` query parameters.
 */
export const Route = createFileRoute("/errors")({
  validateSearch: (search: Record<string, unknown>): Record<string, unknown> => search,
  beforeLoad: ({ search }) => {
    const preserved = Object.fromEntries(
      Object.entries(search ?? {}).filter(([, value]) => value !== undefined),
    );
    throw redirect({
      to: "/docs/errors",
      search: preserved as never,
      replace: true,
    });
  },
  component: () => null,
});
