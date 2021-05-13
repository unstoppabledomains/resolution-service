import qs from 'qs';
import { IsNull, Not } from 'typeorm';
import { logger } from '../../logger';
import ZnsTransaction from '../../models/ZnsTransaction';
import fetch from 'node-fetch';
/**
 * ZnsProvider is a class that communicates with viewblock and zilliqa api to fetch transactions and domains records
 */

export default class ZnsProvider {
  private readonly viewBlockUrl;
  private readonly viewBlockApiKey;

  private readonly zilliqaRegistryAddress;

  constructor() {
    this.zilliqaRegistryAddress = '0x9611c53be6d1b32058b2747bdececed7e1216793';
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
    console.log({lastAtxuid, atxuidFrom, atxuidTo});
    // const stats = await this.getStats();
    const params = {
      network: "mainnet",
      events: true,
      atxuidFrom,
      atxuidTo,
    };
    const query = qs.stringify(params);
    const url = `${
      this.viewBlockUrl
    }/addresses/${this.zilliqaRegistryAddress}/txs?${query}`;
    return await this.request(url);
  }

  private async request(url: string): Promise<ZnsTransaction[]> {
    const response = await fetch(url, {
      headers: { 'X-APIKEY': this.viewBlockApiKey },
    });
    if (response.status !== 200) {
      throw new Error(`ViewBlock API error: ${await response.text()}`);
    }
    const jsonResponse = await response.json();
    return jsonResponse.map((item: any) => ({
      hash: item.hash,
      blockNumber: item.blockHeight,
      atxuid: item.atxuid,
      events: item.events
    })).reverse();
    
  }
}
