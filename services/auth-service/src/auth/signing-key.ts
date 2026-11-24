import { createHash, createPrivateKey, createPublicKey, KeyObject } from 'crypto';
import { loadPublicKeys, requireSecret } from '../common/security';

export interface SigningKey {
  privateKey: KeyObject;
  kid: string;
}

/** RFC 7638 JWK thumbprint: a stable key id derived from the public key itself. */
export function jwkThumbprint(jwk: { e?: string; n?: string }): string {
  return createHash('sha256').update(JSON.stringify({ e: jwk.e, kty: 'RSA', n: jwk.n })).digest('base64url');
}

/**
 * The RSA private key that signs access tokens. Only auth-service receives it
 * (JWT_PRIVATE_KEY_B64: the PEM, base64-encoded on one line so .env files cannot mangle it).
 * Refuses to start if JWT_PUBLIC_JWKS does not publish the matching public key, so a signer
 * and its verifiers can never be deployed out of step.
 */
export function loadSigningKey(): SigningKey {
  const pem = Buffer.from(requireSecret('JWT_PRIVATE_KEY_B64'), 'base64').toString('utf8');
  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey(pem);
  } catch {
    throw new Error('JWT_PRIVATE_KEY_B64 is not a base64-encoded PEM private key');
  }
  if (privateKey.asymmetricKeyType !== 'rsa' || (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
    throw new Error('JWT_PRIVATE_KEY_B64 must be an RSA key of at least 2048 bits');
  }
  const kid = jwkThumbprint(createPublicKey(privateKey).export({ format: 'jwk' }));
  if (!loadPublicKeys().has(kid)) {
    throw new Error(`JWT_PUBLIC_JWKS does not contain the public key of JWT_PRIVATE_KEY_B64 (kid ${kid})`);
  }
  return { privateKey, kid };
}

/** The public JWK Set, restricted to public members, for GET /.well-known/jwks.json. */
export function publicJwks(): { keys: Record<string, unknown>[] } {
  const raw = JSON.parse(process.env.JWT_PUBLIC_JWKS ?? '{"keys":[]}');
  return {
    keys: (raw.keys ?? []).map(({ kty, n, e, kid }: Record<string, unknown>) => ({ kty, n, e, kid, alg: 'RS256', use: 'sig' })),
  };
}
