import { ethers, Wallet, BigNumber } from 'ethers';
import { EthereumProvider } from '../../workers/EthereumProvider';
import { env } from '../../env';
import Sandbox from 'uns/sandbox';

const FundingAmount: BigNumber = ethers.utils.parseUnits('100', 'ether');

export class EthereumTestsHelper {
  private static sandbox: any;
  private static sandboxInitialized = false;
  private static accounts: Record<string, Wallet> = {};

  static async fundAccounts(...accounts: Wallet[]): Promise<void> {
    for (const account of accounts) {
      await EthereumTestsHelper.fundAddress(account.address, FundingAmount);
    }
  }

  static async createAccount(): Promise<Wallet> {
    const account = Wallet.createRandom();
    return account.connect(EthereumProvider);
  }

  static async fundFaucet(): Promise<void> {
    await EthereumTestsHelper.fundAccounts(EthereumTestsHelper.faucet());
  }

  static async fundAddress(
    address: string,
    amount: BigNumber = FundingAmount,
  ): Promise<void> {
    const signer = EthereumTestsHelper.faucet();
    await signer.sendTransaction({
      to: address,
      value: amount,
    });
  }

  static async mineBlocksForConfirmation(
    count: number = env.APPLICATION.ETHEREUM.CONFIRMATION_BLOCKS,
  ): Promise<void> {
    for (let i = 0; i != count; i++) {
      await EthereumTestsHelper.fundAddress(
        '0x000000000000000000000000000000000000dEaD',
        BigNumber.from(1),
      );
    }
  }

  static async startNetwork(): Promise<void> {
    if (!EthereumTestsHelper.sandboxInitialized) {
      EthereumTestsHelper.sandboxInitialized = true;
      const sandbox = await Sandbox.start();
      const accounts: Record<string, any> = sandbox.accounts;

      EthereumTestsHelper.sandbox = sandbox;
      Object.keys(accounts).forEach((key: string) => {
        EthereumTestsHelper.accounts[key] = new Wallet(
          accounts[key].privateKey,
          EthereumProvider,
        );
      });
    }
  }

  static async resetNetwork(): Promise<void> {
    if (EthereumTestsHelper.sandboxInitialized) {
      EthereumTestsHelper.sandbox.reset();
    }
  }

  static async stopNetwork(): Promise<void> {
    if (EthereumTestsHelper.sandboxInitialized) {
      EthereumTestsHelper.sandboxInitialized = false;
      await EthereumTestsHelper.sandbox.stop();
    }
  }

  static owner(): Wallet {
    return EthereumTestsHelper.accounts.owner;
  }

  static minter(): Wallet {
    return EthereumTestsHelper.accounts.minter;
  }

  static faucet(): Wallet {
    return EthereumTestsHelper.accounts.faucet;
  }
}
