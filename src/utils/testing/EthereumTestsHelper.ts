import { ethers, Wallet, BigNumber } from 'ethers';
import * as ContractsModule from '../../contracts';
import { provider } from '../provider';
import * as sinon from 'sinon';
import { CryptoSmartContracts } from './CryptoSmartContracts';

const FundingAmount: BigNumber = ethers.utils.parseUnits('100', 'ether');

export class EthereumTestsHelper {
  private static smartContracts?: CryptoSmartContracts;

  static async fundAddress(
    address: string,
    amount: BigNumber = FundingAmount,
  ): Promise<void> {
    const signer = provider.getUncheckedSigner();
    await signer.sendTransaction({
      to: address,
      value: amount,
    });
  }

  static async createAccount(): Promise<Wallet> {
    const account = Wallet.createRandom();
    return account.connect(provider);
  }

  static async initializeContractsAndStub(
    allowedMintingAddresses: string[] = [],
  ): Promise<CryptoSmartContracts> {
    if (!EthereumTestsHelper.smartContracts) {
      EthereumTestsHelper.smartContracts = new CryptoSmartContracts();
      await EthereumTestsHelper.smartContracts.deployAll(
        allowedMintingAddresses,
      );
      sinon
        .stub(ContractsModule, 'CNS')
        .value(EthereumTestsHelper.smartContracts.getConfig());
    }
    return EthereumTestsHelper.smartContracts;
  }
}
