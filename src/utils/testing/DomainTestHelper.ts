import { ETHContracts } from '../../contracts';
import { env } from '../../env';
import { Domain } from '../../models';
import DomainsResolution from '../../models/DomainsResolution';
import { Attributes, Blockchain } from '../../types/common';

export type TestDomainOptions = {
  name: string;
  node: string;
};

export type TestResolutionOptions = {
  ownerAddress: string;
  resolution: Record<string, string>;
  registry: string;
  resolver: string;
  blockchain: Blockchain;
  networkId: number;
};

export type CreateTestDomainOptions = TestDomainOptions & TestResolutionOptions;

// todo Don't prefill domain registry. Set domain registry from incoming ETH events only.

export class DomainTestHelper {
  private static getRegistryAddressFromLocation(location: string): string {
    switch (location) {
      case 'CNS':
        return ETHContracts.CNSRegistry.address;
      case 'ZNS':
        return env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT;
      case 'UNS':
        return ETHContracts.UNSRegistry.address;
      default:
        return DomainsResolution.NullAddress;
    }
  }

  static async createTestDomain(
    options: Attributes<CreateTestDomainOptions> = {},
  ): Promise<{ domain: Domain; resolution: DomainsResolution }> {
    const {
      domain,
      resolutions: [resolution],
    } = await DomainTestHelper.createTestDomainL2(options, options);
    return { domain, resolution };
  }

  static async createTestDomainL2(
    domainOptions: Attributes<TestDomainOptions> = {},
    l1Options: Attributes<TestResolutionOptions> | undefined = undefined,
    l2Options: Attributes<TestResolutionOptions> | undefined = undefined,
  ): Promise<{ domain: Domain; resolutions: DomainsResolution[] }> {
    const resolutions: DomainsResolution[] = [];
    if (l1Options) {
      resolutions.push(
        new DomainsResolution({
          blockchain: l1Options.blockchain ?? Blockchain.ETH,
          networkId: l1Options.networkId ?? env.APPLICATION.ETHEREUM.NETWORK_ID,
          ownerAddress:
            l1Options.ownerAddress ??
            '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          resolution: l1Options.resolution ?? {},
          resolver:
            l1Options.resolver ?? '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
          registry:
            l1Options.registry ??
            DomainTestHelper.getRegistryAddressFromLocation(
              l1Options.blockchain ?? 'CNS',
            ),
        }),
      );
    }

    if (l2Options) {
      resolutions.push(
        new DomainsResolution({
          blockchain: l2Options.blockchain ?? Blockchain.MATIC,
          networkId: l2Options.networkId ?? env.APPLICATION.POLYGON.NETWORK_ID,
          ownerAddress:
            l2Options.ownerAddress ??
            '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          resolution: l2Options.resolution ?? {},
          resolver:
            l2Options.resolver ?? '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
          registry:
            l2Options.registry ??
            DomainTestHelper.getRegistryAddressFromLocation(
              l2Options.blockchain ?? 'CNS',
            ),
        }),
      );
    }

    const domain = new Domain({
      name: domainOptions.name ?? 'testdomain.crypto',
      node:
        domainOptions.node ??
        '0x77694b72888ab3b13c9c7eb4f343045d3820c1202c1765255b896280a8bc7b55',
      resolutions,
    });
    await domain.save();
    return { domain, resolutions };
  }
}
