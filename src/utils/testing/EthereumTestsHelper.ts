import { ethers, Wallet, BigNumber } from 'ethers';
import * as ContractsModule from '../../contracts';
import { EthereumProvider } from '../../workers/EthereumProvider';
import * as sinon from 'sinon';
import { CryptoSmartContracts } from './CryptoSmartContracts';
import { env } from '../../env';

const FundingAmount: BigNumber = ethers.utils.parseUnits('100', 'ether');

export class EthereumTestsHelper {
  private static smartContracts?: CryptoSmartContracts;

  static async fundAddress(
    address: string,
    amount: BigNumber = FundingAmount,
  ): Promise<void> {
    const signer = EthereumProvider.getSigner(0);
    await signer.sendTransaction({
      to: address,
      value: amount,
    });
  }

  static async createAccount(): Promise<Wallet> {
    const account = Wallet.createRandom();
    return account.connect(EthereumProvider);
  }

  static async mineBlocksForConfirmation(): Promise<void> {
    for (let i = 0; i < env.APPLICATION.ETHEREUM.CNS_CONFIRMATION_BLOCKS; i++) {
      await EthereumTestsHelper.fundAddress(
        '0x000000000000000000000000000000000000dEaD',
        BigNumber.from(1),
      );
    }
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
