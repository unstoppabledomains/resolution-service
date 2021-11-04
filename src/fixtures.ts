import { getConnection } from 'typeorm';
import { eip137Namehash, znsNamehash } from './utils/namehash';

export default async (): Promise<void> => {
  await getConnection().query(
    `INSERT INTO "domains" (name, node)
       VALUES ('zil', '${znsNamehash('zil')}'),
              ('crypto', '${eip137Namehash('crypto')}'),
              ('coin', '${eip137Namehash('coin')}'),
              ('wallet', '${eip137Namehash('wallet')}'),
              ('bitcoin', '${eip137Namehash('bitcoin')}'),
              ('x', '${eip137Namehash('x')}'),
              ('888', '${eip137Namehash('888')}'),
              ('nft', '${eip137Namehash('nft')}'),
              ('dao', '${eip137Namehash('dao')}')
       ON CONFLICT (name) DO NOTHING
    `,
  );
};
