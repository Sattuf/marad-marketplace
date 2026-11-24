#!/usr/bin/env node
/**
 * Prints a fresh RS256 key pair as two .env lines:
 *   JWT_PUBLIC_JWKS='{"keys":[...]}'   public JWK Set for every service (one line, kid = RFC 7638 thumbprint)
 *   JWT_PRIVATE_KEY_B64=...            PKCS#8 PEM, base64 on one line — auth-service only
 */
import { createHash, generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
const kid = createHash('sha256').update(JSON.stringify({ e: jwk.e, kty: 'RSA', n: jwk.n })).digest('base64url');
const jwks = JSON.stringify({ keys: [{ kty: 'RSA', n: jwk.n, e: jwk.e, kid, alg: 'RS256', use: 'sig' }] });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
console.log(`JWT_PUBLIC_JWKS='${jwks}'`);
console.log(`JWT_PRIVATE_KEY_B64=${Buffer.from(pem).toString('base64')}`);
