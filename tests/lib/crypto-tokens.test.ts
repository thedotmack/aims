import { describe, expect, it } from 'vitest';
import {
  hashSecret,
  mintClaimSecret,
  mintDisplayClaimCode,
  mintReplyToken,
  signClaimState,
  verifyClaimState,
  verifyStoredSecret,
} from '@/lib/crypto-tokens';

describe('claims and hashed secrets', () => {
  it('mints a 128-bit secret and a ~48-bit display code', () => {
    const secret = mintClaimSecret();
    expect(secret).toMatch(/^[0-9a-f]{32}$/);
    const code = mintDisplayClaimCode();
    expect(code.startsWith('AIMS-')).toBe(true);
    expect(code.length).toBe(15);
  });

  it('stores only digests and verifies them', () => {
    const token = 'own_plaintext_once';
    const digest = hashSecret(token);
    expect(digest).not.toContain('own_');
    expect(verifyStoredSecret(digest, token)).toBe(true);
    expect(verifyStoredSecret(digest, 'own_other')).toBe(false);
    expect(verifyStoredSecret(token, token)).toBe(true);
  });

  it('signs claimSecret for OAuth state and never embeds the short code', () => {
    const secret = mintClaimSecret();
    const state = signClaimState(secret, 'state-key');
    expect(state.includes('AIMS-')).toBe(false);
    expect(verifyClaimState(state, 'state-key')).toBe(secret);
    expect(verifyClaimState(state, 'wrong')).toBeNull();
  });

  it('mints reply tokens with a rpl_ prefix', () => {
    expect(mintReplyToken().startsWith('rpl_')).toBe(true);
  });
});
