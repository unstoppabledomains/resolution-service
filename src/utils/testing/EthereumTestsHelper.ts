import { ethers, Wallet, BigNumber } from 'ethers';
import * as ContractsModule from '../../contracts';
import { EthereumProvider } from '../../workers/EthereumProvider';
import * as sinon from 'sinon';
import { CnsSmartContracts } from './CnsSmartContracts';
import { UnsSmartContracts } from './UnsSmartContracts';
import { env } from '../../env';

const FundingAmount: BigNumber = ethers.utils.parseUnits('100', 'ether');

export class EthereumTestsHelper {
  private static cnsSmartContracts?: CnsSmartContracts;
  private static unsSmartContracts?: UnsSmartContracts;

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
    for (let i = 0; i < env.APPLICATION.ETHEREUM.CONFIRMATION_BLOCKS; i++) {
      await EthereumTestsHelper.fundAddress(
        '0x000000000000000000000000000000000000dEaD',
        BigNumber.from(1),
      );
    }
  }

  static async initializeCnsContractsAndStub(
    allowedMintingAddresses: string[] = [],
  ): Promise<CnsSmartContracts> {
    if (!EthereumTestsHelper.cnsSmartContracts) {
      EthereumTestsHelper.cnsSmartContracts = new CnsSmartContracts();
      await EthereumTestsHelper.cnsSmartContracts.deployAll(
        allowedMintingAddresses,
      );
      sinon
        .stub(ContractsModule, 'CNS')
        .value(EthereumTestsHelper.cnsSmartContracts.getConfig());
    }
    return EthereumTestsHelper.cnsSmartContracts;
  }

  static async initializeUnsContractsAndStub(
    allowedMintingAddresses: string[] = [],
  ): Promise<UnsSmartContracts> {
    if (!EthereumTestsHelper.unsSmartContracts) {
      EthereumTestsHelper.unsSmartContracts = new UnsSmartContracts();
      await EthereumTestsHelper.unsSmartContracts.deployAll(
        allowedMintingAddresses,
      );
      sinon
        .stub(ContractsModule, 'UNS')
        .value(EthereumTestsHelper.unsSmartContracts.getConfig());
    }
    return EthereumTestsHelper.unsSmartContracts;
  }
}
