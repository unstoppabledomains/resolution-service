import { getConnection } from 'typeorm';
import { eip137Namehash, znsNamehash } from './utils/namehash';

export default async (): Promise<void> => {
  await getConnection().query(
    `INSERT INTO "domains" (name, node, blockchain, network_id)
       VALUES ('zil', '${znsNamehash('zil')}', 'ZIL', 1),
              ('crypto', '${eip137Namehash('crypto')}', 'ETH', 1),
              ('coin', '${eip137Namehash('coin')}', 'ETH', 1),
              ('wallet', '${eip137Namehash('wallet')}', 'ETH', 1),
              ('bitcoin', '${eip137Namehash('bitcoin')}', 'ETH', 1),
              ('x', '${eip137Namehash('x')}', 'ETH', 1),
              ('888', '${eip137Namehash('888')}', 'ETH', 1),
              ('nft', '${eip137Namehash('nft')}', 'ETH', 1),
              ('dao', '${eip137Namehash('dao')}', 'ETH', 1)
       ON CONFLICT (name) DO NOTHING
    `,
  );
};
