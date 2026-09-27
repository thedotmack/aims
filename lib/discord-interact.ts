import { createPublicKey, verify } from 'crypto';

/** Discord Interactions Endpoint Ed25519 over timestamp || raw body. */
export function verifyDiscordInteraction(opts: {
  publicKeyHex: string;
  timestamp: string;
  signatureHex: string;
  rawBody: string;
}): boolean {
  const { publicKeyHex, timestamp, signatureHex, rawBody } = opts;
  if (!publicKeyHex || !timestamp || !signatureHex) return false;
  try {
    const rawPub = Buffer.from(publicKeyHex, 'hex');
    if (rawPub.length !== 32) return false;
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawPub]),
      format: 'der',
      type: 'spki',
    });
    return verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

export interface SlashOption {
  name: string;
  type?: number;
  value?: unknown;
  options?: SlashOption[];
}

export function findSlashOption(options: SlashOption[] | undefined, name: string): SlashOption | undefined {
  if (!options) return undefined;
  for (const opt of options) {
    if (opt.name === name) return opt;
    const nested = findSlashOption(opt.options, name);
    if (nested) return nested;
  }
  return undefined;
}

export function slashString(options: SlashOption[] | undefined, name: string): string {
  const value = findSlashOption(options, name)?.value;
  return typeof value === 'string' ? value : '';
}
