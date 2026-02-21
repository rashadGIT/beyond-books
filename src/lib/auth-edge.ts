// Edge Runtime compatible JWT verification (no Node.js APIs)
// Used only by src/middleware.ts

export interface CognitoUser {
  sub: string;
  email: string;
  name?: string;
}

const REGION = process.env.AWS_REGION!;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

let jwksCache: { keys: JsonWebKey[] } | null = null;

async function getJwks() {
  if (jwksCache) return jwksCache;
  const res = await fetch(
    `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`
  );
  jwksCache = await res.json();
  return jwksCache!;
}

function base64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export async function verifyTokenEdge(token: string): Promise<CognitoUser | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(
      new TextDecoder().decode(base64urlToBytes(parts[1]))
    );

    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    // Check issuer matches our Cognito user pool
    const expectedIssuer = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;
    if (payload.iss !== expectedIssuer) return null;

    // Find matching public key in JWKS
    const jwks = await getJwks();
    const jwk = (jwks.keys as any[]).find(k => k.kid === header.kid);
    if (!jwk) return null;

    // Import RSA public key using Web Crypto (available in Edge Runtime)
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Verify JWT signature
    const signature = base64urlToBytes(parts[2]).buffer as ArrayBuffer;
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`).buffer as ArrayBuffer;
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data);

    if (!valid) return null;

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string | undefined,
    };
  } catch {
    return null;
  }
}
