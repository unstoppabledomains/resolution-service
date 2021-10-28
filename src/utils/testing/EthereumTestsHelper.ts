import { ethers, Wallet, BigNumber } from 'ethers';
import {
  EthereumProvider,
  StaticJsonRpcProvider,
} from '../../workers/EthereumProvider';
import { env } from '../../env';
import Sandbox from 'uns/sandbox';

const FundingAmount: BigNumber = ethers.utils.parseUnits('100', 'ether');

export class EthereumNetworkHelper {
  private sandbox: any;
  private sandboxInitialized = false;
  private accounts: Record<string, Wallet> = {};
  private provider: StaticJsonRpcProvider;

  constructor(provider: StaticJsonRpcProvider = EthereumProvider) {
    this.provider = provider;
  }

  public async fundAccounts(...accounts: Wallet[]): Promise<void> {
    for (const account of accounts) {
      await this.fundAddress(account.address, FundingAmount);
    }
  }

  public async createAccount(): Promise<Wallet> {
    const account = Wallet.createRandom();
    return account.connect(this.provider);
  }

  public async fundFaucet(): Promise<void> {
    await this.fundAccounts(this.faucet());
  }

  public async fundAddress(
    address: string,
    amount: BigNumber = FundingAmount,
  ): Promise<void> {
    const signer = this.faucet();
    await signer.sendTransaction({
      to: address,
      value: amount,
    });
  }

  public async mineBlocksForConfirmation(
    count: number = env.APPLICATION.ETHEREUM.CONFIRMATION_BLOCKS,
  ): Promise<void> {
    for (let i = 0; i != count; i++) {
      await this.fundAddress(
        '0x000000000000000000000000000000000000dEaD',
        BigNumber.from(1),
      );
    }
  }

  public async startNetwork(options: any = {}): Promise<void> {
    if (!this.sandboxInitialized) {
      this.sandboxInitialized = true;
      const sandbox = await Sandbox.start(options);
      const accounts: Record<string, any> = sandbox.accounts;

      this.sandbox = sandbox;
      Object.keys(accounts).forEach((key: string) => {
        this.accounts[key] = new Wallet(
          accounts[key].privateKey,
          this.provider,
        );
      });
    }
  }

  public async resetNetwork(): Promise<void> {
    if (this.sandboxInitialized) {
      this.sandbox.reset();
    }
  }

  public async stopNetwork(): Promise<void> {
    if (this.sandboxInitialized) {
      this.sandboxInitialized = false;
      await this.sandbox.stop();
    }
  }

  public owner(): Wallet {
    return this.accounts.owner;
  }

  public minter(): Wallet {
    return this.accounts.minter;
  }

  public faucet(): Wallet {
    return this.accounts.faucet;
  }

  public getAccount(label: string): Wallet {
    return this.accounts[label];
  }
}

export const EthereumHelper = new EthereumNetworkHelper();
