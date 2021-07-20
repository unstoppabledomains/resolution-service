import { Contract, ContractFactory } from 'ethers';
import { env } from '../../env';
import { getCryptoConfig } from '../../contracts';
import { EthereumProvider } from '../../workers/EthereumProvider';

import registryJson from 'uns/artifacts/UNSRegistry.json';
import mintingManagerJson from 'uns/artifacts/MintingManager.json';

export class UnsSmartContracts {
  private checkContractInitialized(contract: Contract | undefined): Contract {
    if (!contract) {
      throw Error('Contracts not initialized');
    }
    return contract;
  }

  private _registry?: Contract;
  get registry(): Contract {
    return this.checkContractInitialized(this._registry);
  }

  private _mintingManager?: Contract;
  get mintingManager(): Contract {
    return this.checkContractInitialized(this._mintingManager);
  }

  async deployAll(allowedMintingAddresses: string[] = []): Promise<this> {
    const registryFactory = new ContractFactory(
      registryJson.abi,
      registryJson.bytecode,
      EthereumProvider.getSigner(),
    );

    const txPromises = [registryFactory.deploy()];
    const mintingManagerFactory = new ContractFactory(
      mintingManagerJson.abi,
      mintingManagerJson.bytecode,
      EthereumProvider.getSigner(),
    );
    txPromises.push(mintingManagerFactory.deploy());

    [this._registry, this._mintingManager] = await Promise.all(txPromises);
    await this.registry?.functions
      .initialize(this.mintingManager?.address)
      .then((receipt) => receipt.wait());
    await this.mintingManager?.functions
      .initialize(
        this.registry?.address,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      )
      .then((receipt) => receipt.wait());

    for (const mintingAddress of allowedMintingAddresses) {
      await this.mintingManager?.functions
        .addMinter(mintingAddress)
        .then((receipt) => receipt.wait());
    }

    return this;
  }

  getConfig(): Record<
    string,
    {
      address: string;
      legacyAddresses: ReadonlyArray<string>;
      getContract: () => Contract;
    }
  > {
    const networks = {
      [env.APPLICATION.ETHEREUM.CHAIN_ID]: {
        contracts: {
          Registry: {
            address: this.registry?.address,
            legacyAddresses: [],
          },
          MintingManager: {
            address: this.mintingManager?.address,
            legacyAddresses: [],
          },
        },
      },
    };

    return getCryptoConfig(
      env.APPLICATION.ETHEREUM.CHAIN_ID.toString(),
      networks,
    );
  }
}
