import { Contract, ContractFactory } from 'ethers';
import { env } from '../../env';
import { getCryptoConfig } from '../../contracts';
import { CnsProvider } from '../../workers/cns/CnsProvider';

import registryJson from 'dot-crypto/truffle-artifacts/Registry.json';
import mintingControllerJson from 'dot-crypto/truffle-artifacts/MintingController.json';
import resolverJson from 'dot-crypto/truffle-artifacts/Resolver.json';
import legacyResolverJson from 'dot-crypto/truffle-artifacts/LegacyResolver.json';
import signatureControllerJson from 'dot-crypto/truffle-artifacts/SignatureController.json';
import uriPrefixControllerJson from 'dot-crypto/truffle-artifacts/URIPrefixController.json';
import whitelistedMinterJson from 'dot-crypto/truffle-artifacts/WhitelistedMinter.json';
import domainZoneControllerJson from 'dot-crypto/truffle-artifacts/DomainZoneController.json';

export class CryptoSmartContracts {
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

  private _mintingController?: Contract;
  get mintingController(): Contract {
    return this.checkContractInitialized(this._mintingController);
  }

  private _resolver?: Contract;
  get resolver(): Contract {
    return this.checkContractInitialized(this._resolver);
  }

  private _signatureController?: Contract;
  get signatureController(): Contract {
    return this.checkContractInitialized(this._signatureController);
  }

  private _uriPrefixController?: Contract;
  get uriPrefixController(): Contract {
    return this.checkContractInitialized(this._uriPrefixController);
  }

  private _whitelistedMinter?: Contract;
  get whitelistedMinter(): Contract {
    return this.checkContractInitialized(this._whitelistedMinter);
  }

  private _domainZoneController?: Contract;
  get domainZoneController(): Contract {
    return this.checkContractInitialized(this._domainZoneController);
  }

  private _legacyResolver?: Contract;
  get legacyResolver(): Contract {
    if (!this._legacyResolver) {
      throw new Error(`Deploy Legacy Resolver first`);
    }
    return this._legacyResolver;
  }

  async deployLegacyResolver(): Promise<this> {
    if (!this.registry || !this.mintingController) {
      throw new Error(`Deploy Registry and Minting Controller first`);
    }

    const factory = new ContractFactory(
      legacyResolverJson.abi,
      legacyResolverJson.bytecode,
      CnsProvider.getSigner(),
    );
    this._legacyResolver = await factory.deploy(
      this.registry.address,
      this.mintingController.address,
    );

    return this;
  }

  async deployAll(allowedMintingAddresses: string[] = []): Promise<this> {
    const registryFactory = new ContractFactory(
      registryJson.abi,
      registryJson.bytecode,
      CnsProvider.getSigner(),
    );
    this._registry = await registryFactory.deploy();

    const txPromises = [];
    const mintingControllerFactory = new ContractFactory(
      mintingControllerJson.abi,
      mintingControllerJson.bytecode,
      CnsProvider.getSigner(),
    );
    txPromises.push(mintingControllerFactory.deploy(this.registry?.address));

    const signatureControllerFactory = new ContractFactory(
      signatureControllerJson.abi,
      signatureControllerJson.bytecode,
      CnsProvider.getSigner(),
    );
    txPromises.push(signatureControllerFactory.deploy(this.registry?.address));

    const uriPrefixControllerFactory = new ContractFactory(
      uriPrefixControllerJson.abi,
      uriPrefixControllerJson.bytecode,
      CnsProvider.getSigner(),
    );
    txPromises.push(uriPrefixControllerFactory.deploy(this.registry?.address));

    [
      this._mintingController,
      this._signatureController,
      this._uriPrefixController,
    ] = await Promise.all(txPromises);

    await Promise.all([
      this.registry?.functions
        .addController(this.mintingController?.address)
        .then((receipt) => receipt.wait()),
      this.registry?.functions
        .addController(this.signatureController?.address)
        .then((receipt) => receipt.wait()),
      this.registry?.functions
        .addController(this.uriPrefixController?.address)
        .then((receipt) => receipt.wait()),
    ]);

    const whitelistedMinterFactory = new ContractFactory(
      whitelistedMinterJson.abi,
      whitelistedMinterJson.bytecode,
      CnsProvider.getSigner(),
    );
    this._whitelistedMinter = await whitelistedMinterFactory.deploy(
      this.mintingController?.address,
    );

    await this.whitelistedMinter?.functions
      .bulkAddWhitelisted([
        ...allowedMintingAddresses,
        await CnsProvider.getSigner().getAddress(),
      ])
      .then((receipt) => receipt.wait());

    await this.mintingController?.functions
      .addMinter(this.whitelistedMinter?.address)
      .then((receipt) => receipt.wait());

    const resolverFactory = new ContractFactory(
      resolverJson.abi,
      resolverJson.bytecode,
      CnsProvider.getSigner(),
    );
    this._resolver = await resolverFactory.deploy(
      this.registry?.address,
      this.mintingController?.address,
    );

    await this.deployLegacyResolver();

    await this.whitelistedMinter?.functions
      .setDefaultResolver(this.resolver?.address)
      .then((receipt) => receipt.wait());

    const domainZoneControllerFactory = new ContractFactory(
      domainZoneControllerJson.abi,
      domainZoneControllerJson.bytecode,
      CnsProvider.getSigner(),
    );
    this._domainZoneController = await domainZoneControllerFactory.deploy(
      this.registry?.address,
      allowedMintingAddresses,
    );

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
          SignatureController: {
            address: this.signatureController?.address,
            legacyAddresses: [],
          },
          MintingController: {
            address: this.mintingController?.address,
            legacyAddresses: [],
          },
          WhitelistedMinter: {
            address: this.whitelistedMinter?.address,
            legacyAddresses: [],
          },
          URIPrefixController: {
            address: this.uriPrefixController?.address,
            legacyAddresses: [],
          },
          DomainZoneController: {
            address: this.domainZoneController?.address,
            legacyAddresses: [],
          },
          Resolver: {
            address: this.resolver?.address,
            legacyAddresses: [this.legacyResolver?.address],
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
