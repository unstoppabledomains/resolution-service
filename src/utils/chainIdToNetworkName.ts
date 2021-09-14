const chainIdToNetworkName: { [chainId: number]: string } = {
  1: 'mainnet',
  4: 'rinkeby',
  333: 'zil_testnet',
  1337: 'sandbox',
} as const;

export default chainIdToNetworkName;
