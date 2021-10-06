import { Domain } from '../../models';
import { Attributes } from '../../types/common';
import { ETHContracts } from '../../contracts';

export class DomainTestHelper {
  static async createTestDomain(
    options: Attributes<Domain> = {},
  ): Promise<Domain> {
    return Domain.findOrCreate({
      ...options,
      name: options.name ?? 'testdomain.crypto',
      ownerAddress:
        options.ownerAddress ?? '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
      node:
        options.node ??
        '0x77694b72888ab3b13c9c7eb4f343045d3820c1202c1765255b896280a8bc7b55',
      resolution: options.resolution ?? {},
      registry: options.registry ?? ETHContracts.UNSRegistry.address,
      blockchain: options.blockchain ?? 'ETH',
      networkId: options.networkId ?? 1,
      resolver:
        options.resolver ?? '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
    });
  }
}
