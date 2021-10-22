import { getConnection } from 'typeorm';
import { env } from './env';
import { eip137Namehash, znsNamehash } from './utils/namehash';

export default async (): Promise<void> => {
  await getConnection().query(
    `INSERT INTO "domains" (id, name, node)
       VALUES (0, 'zil', '${znsNamehash('zil')}'),
              (1, 'crypto', '${eip137Namehash('crypto')}'),
              (2, 'coin', '${eip137Namehash('coin')}'),
              (3, 'wallet', '${eip137Namehash('wallet')}'),
              (4, 'bitcoin', '${eip137Namehash('bitcoin')}'),
              (5, 'x', '${eip137Namehash('x')}'),
              (6, '888', '${eip137Namehash('888')}'),
              (7, 'nft', '${eip137Namehash('nft')}'),
              (8, 'dao', '${eip137Namehash('dao')}')
       ON CONFLICT (name) DO NOTHING
    `,
  );
  const zilNetId = env.APPLICATION.ZILLIQA.NETWORK_ID;
  const ethNetId = env.APPLICATION.ETHEREUM.NETWORK_ID;
  await getConnection().query(
    `INSERT INTO "domains_resolution" (domain_id, location, blockchain, network_id)
       VALUES (0, 'ZNS', 'ZIL', ${zilNetId}),
              (1, 'CNS', 'ETH', ${ethNetId}),
              (2, 'UNS', 'ETH', ${ethNetId}),
              (3, 'UNS', 'ETH', ${ethNetId}),
              (4, 'UNS', 'ETH', ${ethNetId}),
              (5, 'UNS', 'ETH', ${ethNetId}),
              (6, 'UNS', 'ETH', ${ethNetId}),
              (7, 'UNS', 'ETH', ${ethNetId}),
              (8, 'UNS', 'ETH', ${ethNetId})
    `,
  );
};
