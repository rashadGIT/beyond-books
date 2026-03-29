// auth-edge.ts uses module-level JWKS caching, so we must reset modules
// between tests that need different JWKS responses.

const POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_TESTPOOL';
const VALID_ISSUER = `https://cognito-idp.us-east-1.amazonaws.com/${POOL_ID}`;

// Build a minimal base64url-encoded JWT
function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function buildToken(payload: object, header: object = { alg: 'RS256', kid: 'test-kid' }): string {
  return `${b64url(header)}.${b64url(payload)}.${b64url({ sig: 'fake' })}`;
}

const validPayload = {
  sub: 'user-abc-123',
  email: 'user@example.com',
  name: 'Test User',
  iss: VALID_ISSUER,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const mockJwks = {
  keys: [{ kid: 'test-kid', kty: 'RSA', n: 'test-n', e: 'AQAB', use: 'sig', alg: 'RS256' }],
};

// jsdom defines `crypto` as a configurable getter — we must use defineProperty.
// crypto.subtle is undefined in jsdom, so we provide a full mock.
function setupCryptomock(verifyResult = true) {
  Object.defineProperty(global, 'crypto', {
    configurable: true,
    value: {
      subtle: {
        importKey: jest.fn().mockResolvedValue('mock-crypto-key'),
        verify: jest.fn().mockResolvedValue(verifyResult),
      },
    },
  });
  // TextDecoder / TextEncoder are Node.js builtins but may not be on global in jsdom
  if (typeof (global as any).TextDecoder === 'undefined') {
    (global as any).TextDecoder = require('util').TextDecoder;
  }
  if (typeof (global as any).TextEncoder === 'undefined') {
    (global as any).TextEncoder = require('util').TextEncoder;
  }
}

describe('verifyTokenEdge', () => {
  beforeEach(() => {
    // Reset modules first to clear the JWKS cache inside auth-edge.ts
    jest.resetModules();
    // IMPORTANT: setupCryptomock must run AFTER resetModules because resetModules
    // triggers jsdom re-initialization which overwrites global.crypto
    setupCryptomock(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockJwks),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns null for a token with fewer than 3 parts', async () => {
    const { verifyTokenEdge } = require('../auth-edge');
    const result = await verifyTokenEdge('only.two');
    expect(result).toBeNull();
  });

  it('returns null for a completely malformed token', async () => {
    const { verifyTokenEdge } = require('../auth-edge');
    const result = await verifyTokenEdge('not-a-jwt-at-all');
    expect(result).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const { verifyTokenEdge } = require('../auth-edge');
    const expiredPayload = {
      ...validPayload,
      exp: Math.floor(Date.now() / 1000) - 60,
    };
    const token = buildToken(expiredPayload);
    const result = await verifyTokenEdge(token);
    expect(result).toBeNull();
  });

  it('returns null when issuer does not match Cognito user pool', async () => {
    const { verifyTokenEdge } = require('../auth-edge');
    const wrongIssuerPayload = { ...validPayload, iss: 'https://accounts.google.com' };
    const token = buildToken(wrongIssuerPayload);
    const result = await verifyTokenEdge(token);
    expect(result).toBeNull();
  });

  it('returns null when kid in header does not match any JWKS key', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        keys: [{ kid: 'different-kid', kty: 'RSA', n: 'n', e: 'AQAB' }],
      }),
    });

    const { verifyTokenEdge } = require('../auth-edge');
    const token = buildToken(validPayload, { alg: 'RS256', kid: 'test-kid' });
    const result = await verifyTokenEdge(token);
    expect(result).toBeNull();
  });

  it('returns null when crypto.subtle.verify returns false', async () => {
    setupCryptomock(false);

    const { verifyTokenEdge } = require('../auth-edge');
    const token = buildToken(validPayload);
    const result = await verifyTokenEdge(token);
    expect(result).toBeNull();
  });

  it('returns user object with sub and email for a valid token', async () => {
    const { verifyTokenEdge } = require('../auth-edge');
    const token = buildToken(validPayload);
    const result = await verifyTokenEdge(token);
    expect(result).not.toBeNull();
    expect(result!.sub).toBe('user-abc-123');
    expect(result!.email).toBe('user@example.com');
  });

  it('includes name in the returned user object when present in payload', async () => {
    const { verifyTokenEdge } = require('../auth-edge');
    const token = buildToken(validPayload);
    const result = await verifyTokenEdge(token);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Test User');
  });

  it('returns null and does not throw when fetch throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { verifyTokenEdge } = require('../auth-edge');
    const token = buildToken(validPayload);
    const result = await verifyTokenEdge(token);
    expect(result).toBeNull();
  });
});
