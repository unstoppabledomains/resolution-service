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

export const isOwnedByAddress = async (
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
): Promise<boolean> => {
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
  return false;
};

export const getTokenURI = async ({
  contract,
  nftStandard,
  tokenId,
}: {
  contract: ethers.Contract;
  nftStandard: string;
  tokenId: string;
}): Promise<string> => {
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

export const getImageURLFromTokenURI = async (
  tokenURI: string,
): Promise<string> => {
  const resp = await nodeFetch(useIpfsGateway(tokenURI));
  if (!resp.ok) {
    throw new Error('Failed to fetch from tokenURI');
  }
  const metadata = await resp.json();
  return metadata.image || metadata.image_url;
};

export const getSocialPicture = async (
  domainName: string,
  avatarRecord: string,
  ownerAddress: string,
): Promise<string | undefined> => {
  const { pictureOrUrl, nftStandard } = await getSocialPictureUrl(
    avatarRecord,
    ownerAddress,
  );
  let socialPicture = '';
  if (pictureOrUrl) {
    let data = '',
      mimeType = null;
    if (nftStandard === 'cryptopunks') {
      data = btoa(
        pictureOrUrl
          .replace(`data:image/svg+xml;utf8,`, ``)
          .replace(
            `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" viewBox="0 0 24 24">`,
            `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" viewBox="0 0 24 24"><rect width="100%" height="100%" fill="#648595"/>`,
          ),
      );
      mimeType = 'image/svg+xml';
    } else {
      [data, mimeType] = await getNFTSocialPicture(pictureOrUrl);
    }
    socialPicture = createSocialPictureImage(domainName, data, mimeType);
    return socialPicture;
  }
};

export const getSocialPictureUrl = async (
  avatarRecord: string,
  ownerAddress: string,
): Promise<{ pictureOrUrl: string; nftStandard: string }> => {
  if (!avatarRecord || !ownerAddress) {
    return { pictureOrUrl: '', nftStandard: '' };
  }
  try {
    const { nftStandard, contractAddress, tokenId } = parsePictureRecord(
      avatarRecord,
    );
    const nftContract = await constructNFTContract(
      contractAddress,
      nftStandard,
    );
    const isOwner = await isOwnedByAddress(ownerAddress, {
      contract: nftContract,
      nftStandard,
      tokenId,
    });
    if (!isOwner) {
      throw new Error('User does not own NFT');
    }
    if (nftStandard === 'cryptopunks') {
      const cryptoPunksImageContract = await constructNFTContract(
        CryptoPunksImageContractAddress,
        'cryptopunks',
      );
      const [svgImage] = await cryptoPunksImageContract.functions.punkImageSvg(
        tokenId,
      );
      return { pictureOrUrl: svgImage, nftStandard };
    }
    const tokenURI = await getTokenURI({
      contract: nftContract,
      nftStandard,
      tokenId,
    });
    const imageURL = await getImageURLFromTokenURI(
      tokenURI.replace('0x{id}', tokenId),
    );
    return { pictureOrUrl: imageURL, nftStandard };
  } catch {
    return { pictureOrUrl: '', nftStandard: '' };
  }
};

export const getNFTSocialPicture = async (
  imageUrl: string,
): Promise<[string, string | null]> => {
  const resp = await nodeFetch(useIpfsGateway(imageUrl));
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
  domainName: string,
  data: string,
  mimeType: string | null,
): string => {
  if (domainName.length > 30) {
    domainName = domainName.substring(0, 30 - 3) + '...';
  }
  const fontSize = getFontSize(domainName);
  const svg = createSVGfromTemplate({
    background_image: data,
    domain: domainName,
    fontSize,
    mimeType: mimeType || undefined,
  });

  try {
    return (
      'data:image/svg+xml;base64,' +
      btoa(
        encodeURIComponent(svg).replace(
          /%([0-9A-F]{2})/g,
          function (match, p1) {
            return String.fromCharCode(parseInt(p1, 16));
          },
        ),
      )
    );
  } catch (e) {
    console.log(e);
    return '';
  }
};
