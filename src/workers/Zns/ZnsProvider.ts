import qs from 'qs';
import ZnsTransaction from '../../models/ZnsTransaction';
import fetch from 'node-fetch';
import { Zilliqa } from '@zilliqa-js/zilliqa';
import { env } from '../../env';

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
    this.viewBlockUrl = 'https://api.viewblock.io/v1/zilliqa';
    const key = process.env.VIEWBLOCK_API_KEY;
    if (!key) {
      throw new Error('VIEWBLOCK_API_KEY is not set');
    }
    this.viewBlockApiKey = key;
  }

  async getLatestTransactions(
    from: number,
    to: number,
  ): Promise<ZnsTransaction[]> {
    const params = {
      network: this.network,
      events: true,
      atxuidFrom: from,
      atxuidTo: to,
    };
    const query = qs.stringify(params);
    const url = `${this.viewBlockUrl}/addresses/${this.zilliqaRegistryAddress}/txs?${query}`;
    return await this.request(url).then(this.preparseTx);
  }

  async requestZilliqaResolutionFor(
    resolverAddress: string,
  ): Promise<Record<string, string>> {
    return await this.contractSubStateRpc(resolverAddress, 'records');
  }

  async getChainStats(): Promise<ZilStatsResponse> {
    return await this.request(
      `https://api.viewblock.io/v1/zilliqa/stats?network=${this.network}`,
    );
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

  private preparseTx(response: any): ZnsTransaction[] {
    return response
      .map((item: any) => ({
        hash: item.hash,
        blockNumber: item.blockHeight,
        atxuid: item.atxuid,
        events: item.events,
      }))
      .reverse();
  }

  private async request(url: string): Promise<any> {
    const response = await fetch(url, {
      headers: { 'X-APIKEY': this.viewBlockApiKey },
    });
    if (response.status !== 200) {
      throw new Error(`ViewBlock API error: ${await response.text()}`);
    }
    const jsonResponse = await response.json();
    return jsonResponse;
  }
}
