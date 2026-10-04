import { getRuntimeEnvironment } from "@/lib/config/environment";

function constantTimeEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const longestLength = Math.max(left.length, right.length);

  for (let index = 0; index < longestLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

function decodeBasicCredentials(authorizationHeader: string | null): string | undefined {
  if (authorizationHeader === null || !authorizationHeader.startsWith("Basic ")) {
    return undefined;
  }

  try {
    return atob(authorizationHeader.slice("Basic ".length));
  } catch {
    return undefined;
  }
}

export function isAdminRequestAuthorized(request: Request): boolean {
  const environment = getRuntimeEnvironment();
  const username = environment.adminUsername;
  const password = environment.adminPassword;
  const credentials = decodeBasicCredentials(request.headers.get("authorization"));

  if (username === undefined || password === undefined || credentials === undefined) {
    return false;
  }

  return constantTimeEqual(credentials, `${username}:${password}`);
}
