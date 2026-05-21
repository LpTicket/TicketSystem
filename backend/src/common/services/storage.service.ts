import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  async uploadFile(file: any, folder = 'uploads'): Promise<string> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided or invalid file format');
    }

    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException('Cloudinary is not configured. Event images need a public URL for sharing previews.');
    }

    const mimeType = file.mimetype || 'image/jpeg';
    const base64 = file.buffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64}`;

    try {
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: `lpticket/${folder}`,
        resource_type: 'image',
        overwrite: false,
      });

      this.logger.log(`Uploaded image to Cloudinary: ${result.secure_url}`);
      return result.secure_url;
    } catch (error) {
      this.logger.error('Cloudinary upload failed', error);
      throw new BadRequestException('Could not upload image');
    }
  }
}
