import { AsyncLocalStorage } from "node:async_hooks";

export type ApiKeyPrincipal = {
  id: string;
  email: string;
  createdAt: Date;
  accountStatus: "payment_required" | "active" | "past_due" | "suspended" | "canceled";
  timezone: string;
};

type ApiContext = { principal: ApiKeyPrincipal };
const apiContext = new AsyncLocalStorage<ApiContext>();

export function getApiKeyPrincipal(): ApiKeyPrincipal | null {
  return apiContext.getStore()?.principal ?? null;
}

export function runWithApiKeyPrincipal<T>(principal: ApiKeyPrincipal, callback: () => T): T {
  return apiContext.run({ principal }, callback);
}
