import { getConnection } from 'typeorm';
import { EvmUnstoppableDomainTlds } from './types/common';
import { eip137Namehash, znsNamehash } from './utils/namehash';

export default async (): Promise<void> => {
  const queryValues = [];
  for (const tld of Object.values(EvmUnstoppableDomainTlds)) {
    queryValues.push(`('${tld}', '${eip137Namehash(tld)}')`);
  }

  await getConnection().query(
    `INSERT INTO "domains" (name, node)
       VALUES ('zil', '${znsNamehash('zil')}'),
              ('zil', '${eip137Namehash('zil')}'),
              ${queryValues.join(',')}
       ON CONFLICT (name) DO NOTHING
    `,
  );
};
