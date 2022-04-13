import nodeFetch from 'node-fetch';
import { Domain } from '../../models';
import { createCanvas } from 'canvas';
import createSVGfromTemplate from './svgTemplate';
import btoa from 'btoa';

export const parsePictureRecord = (avatarRecord: string) => {
  const regex =
    /(\d+)\/(erc721|erc1155|cryptopunks):(0x[a-fA-F0-9]{40})\/(\d+)/;
  const matches = regex.exec(avatarRecord);
  if (!matches || matches.length !== 5) {
    throw new Error('Invalid avatar record');
  }
  const [, chainId, nftStandard, contractAddress, tokenId] = matches;

  return { chainId, nftStandard, contractAddress, tokenId };
};

const makeImageLink = (imageUrl: string) => {
  const PINATA_URL = 'https://gateway.pinata.cloud/ipfs/';
  const IPFS_REGEX = /^ipfs:\/\/(ipfs\/)?(.*$)/i;
  const [_url, _prefix, cid] = imageUrl.match(IPFS_REGEX) ?? [];

  if (cid) {
    return `https://ipfs.io/ipfs/${cid}`;
  }

  if (imageUrl.startsWith(PINATA_URL)) {
    return `https://ipfs.io/ipfs/${imageUrl.split(PINATA_URL)[1]}`;
  }

  if (
    imageUrl.includes('api.pudgypenguins.io/penguin/image') &&
    !imageUrl.endsWith('.svg')
  ) {
    return `${imageUrl}.svg`; // Fixes Pudgy Penguins bug, images missing .svg at the end
  }

  return imageUrl;
};

export const getNFTSocialPicture = async (
  pictureOrUrl: string,
): Promise<[string, string | null]> => {
  if (pictureOrUrl.startsWith('data:')) {
    const mimeType = pictureOrUrl.substring(
      pictureOrUrl.indexOf(':') + 1,
      pictureOrUrl.indexOf(';'),
    );
    const base64 = pictureOrUrl.substring(pictureOrUrl.indexOf('base64,') + 7);
    return [base64, mimeType];
  }

  const resp = await nodeFetch(makeImageLink(pictureOrUrl), { timeout: 5000 });
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
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  ctx.font = '18px Arial';
  const text = ctx.measureText(label);
  const fontSize = Math.floor(20 * ((360 - label.length) / text.width));

  if (fontSize > 58) {
    return 54;
  }

  if (fontSize < 21) {
    return 21;
  }

  return fontSize;
};

export const createSocialPictureImage = (
  domain: Domain,
  data: string,
  mimeType: string | null,
  backgroundColor: string,
  raw = false,
): string => {
  const fontSize = getFontSize(
    domain.name.split('.')[0].length > 45
      ? domain.name.substring(0, 45)
      : domain.name,
  );
  const svg = createSVGfromTemplate({
    background_color: backgroundColor,
    background_image: data,
    domain: domain.name,
    fontSize,
    mimeType: mimeType || undefined,
  });

  if (raw) {
    return svg;
  }

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
