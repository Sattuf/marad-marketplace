// Test-only secrets. Real deployments must inject their own values.
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-not-for-production-use';
process.env.INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'test-internal-secret-not-for-production-use';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_for_unit_tests';

// Throwaway RS256 key pair for this test run (access tokens are signed by auth-service's
// private key and verified with the public JWK Set by every service).
if (!process.env.JWT_PUBLIC_JWKS) {
  const { generateKeyPairSync, createHash } = require('crypto');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  const kid = createHash('sha256').update(JSON.stringify({ e: jwk.e, kty: 'RSA', n: jwk.n })).digest('base64url');
  process.env.JWT_PUBLIC_JWKS = JSON.stringify({ keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] });
  process.env.JWT_PRIVATE_KEY_B64 = Buffer.from(privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64');
  process.env.TEST_JWT_KID = kid;
}
