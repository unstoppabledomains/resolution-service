import { logger } from '../logger';
import { Domain } from '../models';
import fetch from 'node-fetch';

type DomainData = {
  addresses: Record<string, string>;
  ipfs: Record<string, string>;
  meta: {
    owner: string;
    type: string;
  };
};

export class CnsValidator {
  private async getDomainData(
    domain: Domain | undefined,
  ): Promise<{ domain: Domain | undefined; data: DomainData | undefined }> {
    if (domain === undefined) {
      return { domain, data: undefined };
    }
    const response = await fetch(
      `https://unstoppabledomains.com/api/v1/${encodeURI(domain.name)}`,
    );
    if (response.status !== 200) {
      throw new Error(`API error: ${await response.json()}`);
    }
    return { domain, data: await response.json() };
  }

  private async compareDomain(
    domain: Domain | undefined,
    data: DomainData | undefined,
  ): Promise<boolean> {
    if (domain === undefined || data === undefined) {
      logger.warn('Some data was undefined');
      return false;
    }

    let allOk = true;
    for (const item in Object.keys(data.addresses)) {
      if (
        data.addresses[item] !== domain.resolution[`crypto.${item}.address`]
      ) {
        logger.warn(
          `Fetched data does not equal to DB data: Domain name ${
            domain.name
          }, key "crypto.${item}.address" ("${item}"), DB value ${
            domain.resolution[`crypto.${item}.address`]
          }, Fetched value ${data.addresses[item]}`,
        );
        allOk = false;
      }
    }

    if (domain.ownerAddress !== data.meta.owner) {
      logger.warn(
        `Fetched data does not equal to DB data: Domain name ${domain.name}, DB owner "${domain.ownerAddress}", Fetched owner ${data.meta.owner}`,
      );
      allOk = false;
    }

    return allOk;
  }

  public async getDomainCount(): Promise<number> {
    return await Domain.count();
  }

  public async runValidation(n: number): Promise<void> {
    logger.info(`runValidation ${n}`);
    // select N random domains
    const minId = (
      await Domain.createQueryBuilder().select('min(id)', 'min').getRawOne()
    ).min;
    const maxId = (
      await Domain.createQueryBuilder().select('max(id)', 'max').getRawOne()
    ).max;
    const randomIds: number[] = Array.from({ length: n }, () => {
      return minId + Math.floor((maxId - minId) * Math.random());
    });
    let proms = [];
    for (const id of randomIds) {
      proms.push(Domain.findOne(id));
    }
    const domains = await Promise.all(proms);

    // get domain data from website
    proms = [];
    for (const domain of domains) {
      proms.push(this.getDomainData(domain));
    }
    const fetchedDomains: {
      domain: Domain | undefined;
      data: DomainData | undefined;
    }[] = await Promise.all(proms);

    // check if data matches
    let allOk = true;
    for (const record of fetchedDomains) {
      const check = await this.compareDomain(record.domain, record.data);
      allOk &&= check;
    }

    if (allOk) {
      logger.info('all checks have passed');
    } else {
      logger.info('some checks have failed');
    }
  }
}

export async function runValidation() {
  const validator = new CnsValidator();
  await validator.runValidation((await validator.getDomainCount()) * 0.001);
}
