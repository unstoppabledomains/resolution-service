import qs from 'qs';
import { ZnsTransactionEvent } from '../../models/ZnsTransaction';
import fetch from 'node-fetch';
import { Zilliqa } from '@zilliqa-js/zilliqa';
import { env } from '../../env';

// This type is being returned from viewblock api when chain stats are fetched
type ZilStatsResponse = {
  nodeCount: number;
  txHeight: number;
  dsHeight: number;
  shardingDifficulty: number;
  dsDifficulty: number;
  txCount: number;
  addressCount: number;
  shardingPeerCount: number[];
};

// This type is being returned from viewblock api when transactions are fetched
type ZnsTransactionResponse = {
  hash: string;
  blockHeight: number;
  from: string;
  to: string;
  value: string;
  fee: string;
  timestamp: Date;
  signature: string;
  direction: 'in' | 'out';
  nonce: number;
  receiptSuccess: boolean;
  data: string;
  internalTransfers: Record<string, unknown>[];
  events: ZnsTransactionEvent[];
  transitions: Record<string, unknown>[];
  atxuid: number;
};

// This is the only information we need from the ZnsTransactionResponse
export type ZnsTx = {
  hash: string;
  blockNumber: number;
  atxuid: number;
  events: ZnsTransactionEvent[];
};

/**
 * ZnsProvider is a class that communicates with viewblock and zilliqa api to fetch transactions and domains records
 */
export default class ZnsProvider {
  private readonly viewBlockUrl;
  private readonly viewBlockApiKey;

  private readonly zilliqaRegistryAddress;
  private readonly network;
  private readonly zilliqa;

  constructor() {
    this.network = env.APPLICATION.ZILLIQA.NETWORK;
    this.zilliqaRegistryAddress = env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT;
    this.zilliqa = new Zilliqa(env.APPLICATION.ZILLIQA.JSON_RPC_API_URL);
    this.viewBlockUrl = env.APPLICATION.ZILLIQA.VIEWBLOCK_API_URL;
    const key = env.APPLICATION.ZILLIQA.VIEWBLOCK_API_KEY;
    if (!key) {
      throw new Error('VIEWBLOCK_API_KEY is not set');
    }
    this.viewBlockApiKey = key;
  }

  async getLatestTransactions(from: number, to: number): Promise<ZnsTx[]> {
    const params = {
      network: this.network,
      events: true,
      atxuidFrom: from,
      atxuidTo: to,
    };
    const query = qs.stringify(params);
    const url = `${this.viewBlockUrl}/addresses/${this.zilliqaRegistryAddress}/txs?${query}`;
    return this.request<ZnsTransactionResponse[]>(url).then(this.preparseTx);
  }

  async requestZilliqaResolutionFor(
    resolverAddress: string,
  ): Promise<Record<string, string>> {
    return this.contractSubStateRpc(resolverAddress, 'records');
  }

  async getChainStats(): Promise<ZilStatsResponse> {
    return this.request(`${this.viewBlockUrl}/stats?network=${this.network}`);
  }

  private async contractSubStateRpc(address: string, name: string) {
    const state = await this.zilliqa.provider.send(
      'GetSmartContractSubState',
      address.replace('0x', '').toLowerCase(),
      name,
      [],
    );
    return state.result?.[name];
  }

  private preparseTx(response: ZnsTransactionResponse[]): ZnsTx[] {
    return response
      .map((item) => ({
        hash: item.hash,
        blockNumber: item.blockHeight,
        atxuid: item.atxuid,
        events: item.events,
      }))
      .reverse();
  }

  private async request<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: { 'X-APIKEY': this.viewBlockApiKey },
    });

    if (response.status !== 200) {
      throw new Error(`ViewBlock API error: ${await response.json()}`);
    }
    return response.json();
  }
}
