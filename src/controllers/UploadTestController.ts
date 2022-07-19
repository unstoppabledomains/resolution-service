import 'reflect-metadata';
import { Get, JsonController, Param } from 'routing-controllers';
import { ResponseSchema } from 'routing-controllers-openapi';
import { Domain } from '../models';
import { getDomainResolution } from '../services/Resolution';
import { IsNotEmpty, IsString } from 'class-validator';
import { fetchTokenMetadata } from './MetaDataController';
import {
  getNFTSocialPicture,
  parsePictureRecord,
} from '../utils/socialPicture';
import { Storage } from '@google-cloud/storage';
import { env } from '../env';

const storageOptions = env.CLOUD_STORAGE.API_ENDPOINT_URL
  ? { apiEndpoint: env.CLOUD_STORAGE.API_ENDPOINT_URL } // for development using local emulator
  : {}; // for production
const storage = new Storage(storageOptions);

enum UploadStatus {
  Found = 'FOUND',
  Cached = 'FOUND_IN_CACHE',
  NotFound = 'NOT_FOUND',
}

class UploadResponse {
  @IsNotEmpty()
  @IsString()
  domain: string;

  @IsString()
  pfpImage?: string;

  @IsNotEmpty()
  @IsString()
  status: string;
}

@JsonController()
export class UploadTestController {
  @Get('/test_upload/:domainName')
  @ResponseSchema(UploadResponse)
  async getDomain(
    @Param('domainName') domainName: string,
  ): Promise<UploadResponse> {
    domainName = domainName.toLowerCase();
    const domain = await Domain.findOne({
      where: { name: domainName },
      relations: ['resolutions'],
    });
    if (domain) {
      const resolution = getDomainResolution(domain);
      const socialPic = resolution?.resolution['social.picture.value'];

      if (resolution && socialPic) {
        const { contractAddress, tokenId } = parsePictureRecord(socialPic);
        const nftPfpFolder = 'nft-pfp';
        const fileName = `${nftPfpFolder}/${contractAddress}_${tokenId}`;
        const bucketName = env.CLOUD_STORAGE.CLIENT_ASSETS.BUCKET_ID;
        const hostname =
          env.CLOUD_STORAGE.API_ENDPOINT_URL ||
          'https://storage.googleapis.com';
        const imageURL = `${hostname}/${bucketName}/${fileName}`;
        const bucket = storage.bucket(bucketName);

        const [fileExists] = await bucket.file(fileName).exists();
        if (!fileExists) {
          // fetch image from token URI
          const { image } = await fetchTokenMetadata(
            domain,
            resolution,
            false,
            true,
          );
          const [imageData, mimeType] = await getNFTSocialPicture(image).catch(
            () => ['', null],
          );

          // upload image to bucket
          if (imageData) {
            const file = bucket.file(fileName);
            // cache in the storage
            const imageBuffer = Buffer.from(imageData, 'base64');
            await file.save(imageBuffer, {
              metadata: {
                contentType: mimeType,
              },
            });
            return {
              domain: domainName,
              pfpImage: imageURL,
              status: UploadStatus.Found,
            };
          }
        } else {
          return {
            domain: domainName,
            pfpImage: imageURL,
            status: 'FOUND_IN_CACHE',
          };
        }
      }
    }
    return {
      domain: domainName,
      pfpImage: '',
      status: UploadStatus.NotFound,
    };
  }
}
