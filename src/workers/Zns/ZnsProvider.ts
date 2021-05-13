import qs from 'qs';
import ZnsTransaction from '../../models/ZnsTransaction';
import fetch from 'node-fetch';
import { env } from '../../env';
/**
 * ZnsProvider is a class that communicates with viewblock and zilliqa api to fetch transactions and domains records
 */

export default class ZnsProvider {
  private readonly viewBlockUrl;
  private readonly viewBlockApiKey;

  private readonly zilliqaRegistryAddress;
  private readonly network;

  constructor() {
    this.network = env.APPLICATION.ZILLIQA.NETWORK;
    this.zilliqaRegistryAddress = env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT;
    this.viewBlockUrl = 'https://api.viewblock.io/v1/zilliqa';
    const key = process.env.VIEWBLOCK_API_KEY;
    if (!key) {
      console.log('no key?');
      throw new Error('VIEWBLOCK_API_KEY is not set');
    }
    this.viewBlockApiKey = key;
  }

  async getLatestTransactions(perPage: number): Promise<ZnsTransaction[]> {
    const lastAtxuid = await ZnsTransaction.latestAtxuid();
    const atxuidFrom = lastAtxuid + 1;
    const atxuidTo = atxuidFrom + perPage - 1;
    console.log({ lastAtxuid, atxuidFrom, atxuidTo });
    // const stats = await this.getStats();
    const params = {
      network: this.network,
      events: true,
      atxuidFrom,
      atxuidTo,
    };
    const query = qs.stringify(params);
    const url = `${this.viewBlockUrl}/addresses/${this.zilliqaRegistryAddress}/txs?${query}`;
    return await this.request(url);
  }

  async requestZilliqaResolutionFor(
    resolverAddress: string,
  ): Promise<Record<string, string>> {
    const recordResponse = await this.fetchZilliqa([
      resolverAddress.replace('0x', ''),
      'records',
      [],
    ]).then((res) => res.result.records || {});
    return recordResponse;
  }

  private async fetchZilliqa(params: [string, string, string[]]) {
    const body = {
      method: 'GetSmartContractSubState',
      id: '1',
      jsonrpc: '2.0',
      params,
    };

    return await fetch(env.APPLICATION.ZILLIQA.ZNS_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }).then((res) => res.json());
  }

  private async request(url: string): Promise<ZnsTransaction[]> {
    const response = await fetch(url, {
      headers: { 'X-APIKEY': this.viewBlockApiKey },
    });
    if (response.status !== 200) {
      throw new Error(`ViewBlock API error: ${await response.text()}`);
    }
    const jsonResponse = await response.json();
    return jsonResponse
      .map((item: any) => ({
        hash: item.hash,
        blockNumber: item.blockHeight,
        atxuid: item.atxuid,
        events: item.events,
      }))
      .reverse();
  }
}
