export function issueTokens(empId: string) {
  const expires = Date.now() + 60 * 60 * 1000
  return {
    accessToken: `mock.${empId}.${expires}`,
    refreshToken: `mockr.${empId}.${Date.now()}`,
    expiresAt: new Date(expires).toISOString(),
  }
}
