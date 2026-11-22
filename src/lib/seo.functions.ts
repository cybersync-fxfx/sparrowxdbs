import { createServerFn } from "@tanstack/react-start";
import { resolveSeoProfileKeyForHost, type SeoProfileKey } from "./seo-profiles";

export const getRequestSeoProfileKey = createServerFn({ method: "GET" }).handler(
  async (): Promise<SeoProfileKey> => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host") || "";
    return resolveSeoProfileKeyForHost(host);
  },
);
