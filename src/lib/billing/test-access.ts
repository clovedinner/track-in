export function canUseBillingTestMode(userId: string): boolean {
  const allowedUserId = process.env.BILLING_TEST_USER_ID?.trim();
  return process.env.BILLING_TEST_MODE?.trim().toLowerCase() === "true" && Boolean(allowedUserId) && userId === allowedUserId;
}
