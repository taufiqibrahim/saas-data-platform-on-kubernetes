const FRIENDLY_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

const getRandomInt = (min: number, max: number) => {
  const range = max - min;
  const uint32 = new Uint32Array(1);
  window.crypto.getRandomValues(uint32);
  return min + (uint32[0] % range);
};

function randomChoice(chars: string): string {
  const index = getRandomInt(0, chars.length);
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
