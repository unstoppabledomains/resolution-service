import { getConnection } from 'typeorm';
import { eip137Namehash, znsNamehash } from './utils/namehash';

export default async (): Promise<void> => {
  await getConnection().query(
    `INSERT INTO "domains" (name, node, location)
       VALUES ('zil', '${znsNamehash('zil')}', 'ZNS'),
              ('crypto', '${eip137Namehash('crypto')}', 'CNS')
              ('coin', '${eip137Namehash('coin')}', 'UNSL1')
              ('wallet', '${eip137Namehash('wallet')}', 'UNSL1')
              ('bitcoin', '${eip137Namehash('bitcoin')}', 'UNSL1')
              ('x', '${eip137Namehash('x')}', 'UNSL1')
              ('888', '${eip137Namehash('888')}', 'UNSL1')
              ('nft', '${eip137Namehash('nft')}', 'UNSL1')
              ('dao', '${eip137Namehash('dao')}', 'UNSL1')
       ON CONFLICT (name) DO NOTHING
    `,
  );
};
