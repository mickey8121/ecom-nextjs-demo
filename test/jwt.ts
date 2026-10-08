const encode = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

export function makeJwt(claims: Record<string, unknown>) {
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}
