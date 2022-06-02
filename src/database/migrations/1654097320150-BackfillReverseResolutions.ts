import { getRepository, MigrationInterface, QueryRunner } from 'typeorm';
import { logger } from '../../logger';
import {
  CnsRegistryEvent,
  Domain,
  DomainsReverseResolution,
} from '../../models';
import { Blockchain } from '../../types/common';

export class BackfillReverseResolutions1654097320150
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const events = await queryRunner.manager.find(CnsRegistryEvent, {
      where: {
        type: ['SetReverse', 'RemoveReverse'],
      },
      order: {
        createdAt: 'ASC',
      },
    });
    const reverseResolutions: Record<
      string,
      DomainsReverseResolution | undefined
    > = {};
    for (const event of events) {
      switch (event.type) {
        case 'SetReverse': {
          const { addr, tokenId } = event.returnValues;
          const domain = await Domain.findOne({ node: tokenId });
          const reverse = new DomainsReverseResolution({
            reverseAddress: addr,
            networkId: event.networkId,
            blockchain: event.blockchain as Blockchain,
            domain: domain,
          });
          reverseResolutions[addr] = reverse;
          break;
        }
        case 'RemoveReverse': {
          const { addr } = event.returnValues;
          reverseResolutions[addr] = undefined;
          break;
        }
        default:
          break;
      }
    }
    const resolutions = Object.values(reverseResolutions).filter(
      (val): val is DomainsReverseResolution => !!val,
    );
    await queryRunner.manager
      .getRepository(DomainsReverseResolution)
      .save(resolutions);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query('delete * from domains_reverse_resolution');
  }
}
