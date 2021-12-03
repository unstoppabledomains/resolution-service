import { ethers } from 'ethers';
import { env } from '../../env';
import nodeFetch from 'node-fetch';
import { Domain } from '../../models';
import { createCanvas } from 'canvas';
import createSVGfromTemplate from './svgTemplate';
import btoa from 'btoa';

const CryptoPunksImageContractAddress =
  '0x16F5A35647D6F03D5D3da7b35409D65ba03aF3B2';

const parsePictureRecord = (avatarRecord: string) => {
  const regex = /(1)\/(erc721|erc1155|cryptopunks):(0x[a-fA-F0-9]{40})\/(\d+)/;
  const matches = regex.exec(avatarRecord);
  if (!matches || matches.length !== 5) {
    throw new Error('Invalid avatar record');
  }
  const [, chainId, nftStandard, contractAddress, tokenId] = matches;

  return { chainId, nftStandard, contractAddress, tokenId };
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
    cryptopunks: [
      'function punkIndexToAddress(uint256 _tokenId) public view returns (address)',
      'function punkImageSvg(uint16 index) external view returns (string memory)',
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
  if (nftStandard === 'cryptopunks') {
    return contract.functions
      .punkIndexToAddress(tokenId)
      .then(
        ([address]) => address.toLowerCase() === ownerAddress.toLowerCase(),
      );
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
  const resp = await nodeFetch(useIpfsGateway(tokenURI), { timeout: 3000 });
  if (!resp.ok) {
    throw new Error('Failed to fetch from tokenURI');
  }
  const metadata = await resp.json();
  return {
    imageURL: metadata.image || metadata.image_url,
    backgroundColor: metadata.background_color || '',
  };
};

export const hasSocialPicture = async (
  avatarRecord: string,
  ownerAddress: string,
): Promise<boolean> => {
  if (!avatarRecord || !ownerAddress) {
    return false;
  }
  try {
    const { nftStandard, contractAddress, tokenId } =
      parsePictureRecord(avatarRecord);
    const nftContract = await constructNFTContract(
      contractAddress,
      nftStandard,
    );
    const isOwner = await isOwnedByAddress(ownerAddress, {
      contract: nftContract,
      nftStandard,
      tokenId,
    });
    return isOwner === '' ? false : isOwner;
  } catch (err) {
    return false;
  }
};

export const getSocialPictureUrl = async (
  avatarRecord: string,
  ownerAddress: string,
): Promise<{
  pictureOrUrl: string;
  nftStandard: string;
  backgroundColor: string;
}> => {
  if (!(await hasSocialPicture(avatarRecord, ownerAddress))) {
    return { pictureOrUrl: '', nftStandard: '', backgroundColor: '' };
  }
  try {
    const { nftStandard, contractAddress, tokenId } =
      parsePictureRecord(avatarRecord);

    if (nftStandard === 'cryptopunks') {
      const cryptoPunksImageContract = await constructNFTContract(
        CryptoPunksImageContractAddress,
        'cryptopunks',
      );
      const [svgImage] = await cryptoPunksImageContract.functions.punkImageSvg(
        tokenId,
      );
      return { pictureOrUrl: svgImage, nftStandard, backgroundColor: '' };
    }

    const nftContract = await constructNFTContract(
      contractAddress,
      nftStandard,
    );
    const tokenURI = await getTokenURI({
      contract: nftContract,
      nftStandard,
      tokenId,
    });
    const { imageURL, backgroundColor } = await getImageURLFromTokenURI(
      tokenURI.replace('0x{id}', tokenId).replace('{id}', tokenId),
    );
    return { pictureOrUrl: imageURL, nftStandard, backgroundColor };
  } catch {
    return { pictureOrUrl: '', nftStandard: '', backgroundColor: '' };
  }
};

export const getNFTSocialPicture = async (
  nftStandard: string,
  pictureOrUrl: string,
): Promise<[string, string | null]> => {
  if (nftStandard === 'cryptopunks') {
    const data = btoa(
      pictureOrUrl
        .replace(`data:image/svg+xml;utf8,`, ``)
        .replace(
          `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" viewBox="0 0 24 24">`,
          `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" viewBox="0 0 24 24"><rect width="100%" height="100%" fill="#648595"/>`,
        ),
    );
    const mimeType = 'image/svg+xml';
    return [data, mimeType];
  }

  const resp = await nodeFetch(useIpfsGateway(pictureOrUrl), { timeout: 3000 });
  if (!resp.ok) {
    throw new Error('Failed to fetch NFT image');
  }
  const data = await resp.buffer();
  const mimeType = resp.headers.get('Content-Type');
  const base64 = data.toString('base64');

  return [base64, mimeType];
};

const getFontSize = (name: string): number => {
  const [label] = name.split('.');
  const canvas = createCanvas(300, 300);
  const ctx = canvas.getContext('2d');
  ctx.font = '18px Arial';
  const text = ctx.measureText(label);
  const fontSize = Math.floor(20 * ((200 - label.length) / text.width));
  return fontSize < 34 ? fontSize : 32;
};

export const createSocialPictureImage = (
  domain: Domain,
  data: string,
  mimeType: string | null,
  backgroundColor: string,
): string => {
  let name = domain.name;
  if (name.length > 30) {
    name = name.substring(0, 30 - 3) + '...';
  }
  const fontSize = getFontSize(name);
  const svg = createSVGfromTemplate({
    background_color: backgroundColor,
    background_image: data,
    domain: name,
    fontSize,
    mimeType: mimeType || undefined,
  });

  try {
    return svg;
  } catch (e) {
    console.log(e);
    return '';
  }
};
