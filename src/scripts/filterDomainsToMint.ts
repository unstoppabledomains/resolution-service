import { readFile, writeFile } from 'fs/promises';

type Domain = {
  name: string;
  node: string;
  exists: boolean;
  blockchain: string;
};
const fileName = 'domains.json';

const run = async () => {
  const domains = JSON.parse(await readFile(fileName, 'utf8'));

  // Filter:
  //  1) existing domains on l2
  //  2) tlds
  //  3) zil domains
  const domainsToStore = domains.filter((domain: Domain, i: number) => {
    return (
      !domain.exists && domain.name.includes('.') && domain.blockchain !== 'ZIL'
    );
  });

  await writeFile(fileName, JSON.stringify(domainsToStore), 'utf8');
  console.log(`Filtered ${domainsToStore.length} domains to ${fileName}`);
};

run();
