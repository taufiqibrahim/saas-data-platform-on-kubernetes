// utils/idGenerator.ts
import crypto from 'crypto';

const FRIENDLY_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomChoice(chars: string): string {
  const index = crypto.randomInt(0, chars.length);
  return chars[index];
}

export function generateAccountId(length: number = 11): string {
  // must start with a letter
  const firstChar = randomChoice('abcdefghijklmnopqrstuvwxyz');
  const rest = Array.from({ length: length - 1 }, () => randomChoice(FRIENDLY_CHARS)).join('');
  return firstChar + rest;
}

export function generateWorkspaceId(length: number = 9): string {
  const body = Array.from({ length }, () => randomChoice(FRIENDLY_CHARS)).join('');
  return `w-${body}`;
}

// // Example usage
// if (require.main === module) {
//   const accountId = generateAccountId();
//   const workspaceId = generateWorkspaceId();
//   console.log("account_id:", accountId);
//   console.log("workspace_id:", workspaceId);
// }
