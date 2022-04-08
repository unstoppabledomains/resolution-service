import { readFile, writeFile } from 'fs/promises';
import { providers, Contract } from 'ethers';

const { POLYGON_JSON_RPC_API_URL } = process.env;
const provider = new providers.JsonRpcProvider(POLYGON_JSON_RPC_API_URL);
const contractAddress = '0x2a93C52E7B6E7054870758e15A1446E769EdfB93';
const fileName = 'domains.json';

type Domain = { node: string; exists: boolean };

const run = async () => {
  const abi = await readFile(__dirname + '/ReadProxyABI.json', 'utf8');
  const contract = new Contract(contractAddress, abi, provider);
  const domains = JSON.parse(await readFile(fileName, 'utf8'));

  const existenceList = await Promise.all(
    domains.map(async (domain: Domain) => {
      return await contract.exists(domain.node);
    }),
  );

  const domainsToStore = domains.map((domain: Domain, i: number) => {
    domain.exists = existenceList[i] as boolean;
    return domain;
  });

  await writeFile(fileName, JSON.stringify(domainsToStore), 'utf8');
  console.log(`Checked ${domainsToStore.length} domains to ${fileName}`);
};

run();
