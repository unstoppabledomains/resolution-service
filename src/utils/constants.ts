export const Blockchain = { ETH: 'ETH', ZIL: 'ZIL', MATIC: 'MATIC' } as {
  ETH: 'ETH';
  ZIL: 'ZIL';
  MATIC: 'MATIC';
};

export type BlockchainType = keyof typeof Blockchain;
