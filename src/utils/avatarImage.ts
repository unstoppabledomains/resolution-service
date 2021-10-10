import { ethers } from 'ethers';
import { env } from '../env';
import nodeFetch from 'node-fetch';

const parseAvatarRecord = (avatarRecord: string) => {
  const regex = /(erc721|erc1155):(0x[a-fA-F0-9]{40})\/(\d+)/;
  const matches = regex.exec(avatarRecord);
  if (!matches || matches.length !== 4) {
    throw new Error('Invalid avatar record');
  }
  const [, nftStandard, contractAddress, tokenId] = matches;

  return { nftStandard, contractAddress, tokenId };
};

const constructNFTContract = async (
  contractAddress: string,
  nftStandard: string,
) => {
  const abis: Record<string, string[]> = {
    erc721: [
      'function tokenURI(uint256 _tokenId) external view returns (string)',
      'function ownerOf(uint256 _tokenId) external view returns (address)',
    ],
    erc1155: [
      'function uri(uint256 _id) external view returns (string memory)',
      'function balanceOf(address _owner, uint256 _id) external view returns (uint256)',
    ],
  };
  if (!abis[nftStandard]) {
    throw new Error('Unsupported NFT standard: ' + nftStandard);
  }
  const provider = new ethers.providers.JsonRpcProvider(
    env.APPLICATION.ETHEREUM.JSON_RPC_API_URL,
  );
  await provider.ready;
  const nftContract = new ethers.Contract(
    contractAddress,
    abis[nftStandard],
    provider,
  );
  return nftContract;
};

const isOwnedByAddress = (
  ownerAddress: string,
  {
    contract,
    nftStandard,
    tokenId,
  }: {
    contract: ethers.Contract;
    nftStandard: string;
    tokenId: string;
  },
) => {
  if (nftStandard === 'erc721') {
    return contract.functions
      .ownerOf(tokenId)
      .then(([owner]) => owner.toLowerCase() === ownerAddress.toLowerCase());
  }
  if (nftStandard === 'erc1155') {
    return contract.functions
      .balanceOf(ownerAddress, tokenId)
      .then((balance) => balance > 0);
  }
  return '';
};

const getTokenURI = ({
  contract,
  nftStandard,
  tokenId,
}: {
  contract: ethers.Contract;
  nftStandard: string;
  tokenId: string;
}) => {
  if (nftStandard === 'erc721') {
    return contract.functions.tokenURI(tokenId).then(([tokenURI]) => tokenURI);
  }
  if (nftStandard === 'erc1155') {
    return contract.functions.uri(tokenId).then(([tokenURI]) => tokenURI);
  }
  return '';
};

const useIpfsGateway = (url: string) => {
  if (url.startsWith('ipfs://ipfs/')) {
    return url.replace('ipfs://ipfs/', 'https://ipfs.io/ipfs/');
  }
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  return url;
};

const getImageURLFromTokenURI = async (tokenURI: string) => {
  const metadata = await nodeFetch(useIpfsGateway(tokenURI)).then((resp) =>
    resp.json(),
  );
  return metadata.image;
};

export const getAvatarImageUrl = async (
  avatarRecord: string,
  ownerAddress: string,
): Promise<string> => {
  if (!avatarRecord || !ownerAddress) {
    return '';
  }
  const { nftStandard, contractAddress, tokenId } = parseAvatarRecord(
    avatarRecord,
  );
  const nftContract = await constructNFTContract(contractAddress, nftStandard);
  const isOwner = await isOwnedByAddress(ownerAddress, {
    contract: nftContract,
    nftStandard,
    tokenId,
  });
  if (!isOwner) {
    throw new Error('User does not own NFT');
  }
  const tokenURI = await getTokenURI({
    contract: nftContract,
    nftStandard,
    tokenId,
  });
  const imageURL = await getImageURLFromTokenURI(tokenURI);
  return imageURL;
};
