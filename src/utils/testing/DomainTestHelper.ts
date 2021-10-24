import { env } from '../../env';
import { Domain } from '../../models';
import DomainsResolution from '../../models/DomainsResolution';
import { Attributes, Blockchain } from '../../types/common';
import { getRegistryAddressFromLocation } from '../domainLocationUtils';

export type CreateTestDomainOptions = {
  name: string;
  ownerAddress: string;
  node: string;
  resolution: Record<string, string>;
  registry: string;
  resolver: string;
  blockchain: Blockchain;
  networkId: number;
};

export class DomainTestHelper {
  static async createTestDomain(
    options: Attributes<CreateTestDomainOptions> = {},
  ): Promise<{ domain: Domain; resolution: DomainsResolution }> {
    const resolution = new DomainsResolution({
      blockchain: options.blockchain ?? Blockchain.ETH,
      networkId: options.networkId ?? env.APPLICATION.ETHEREUM.NETWORK_ID,
      ownerAddress:
        options.ownerAddress ?? '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
      resolution: options.resolution ?? {},
      resolver:
        options.resolver ?? '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
      registry:
        options.registry ??
        getRegistryAddressFromLocation(options.blockchain ?? 'CNS'),
    });

    const domain = new Domain({
      name: options.name ?? 'testdomain.crypto',
      node:
        options.node ??
        '0x77694b72888ab3b13c9c7eb4f343045d3820c1202c1765255b896280a8bc7b55',
      resolutions: [resolution],
    });
    await domain.save();
    return { domain, resolution };
  }
}
