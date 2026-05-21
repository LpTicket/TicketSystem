import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Standardized upload method that returns a Base64 data URI.
   * This ensures images are stored directly in the database, making them persistent on ephemeral platforms like Render.
   */
  async uploadFile(file: any, _folder = 'uploads'): Promise<string> {
    if (!file || !file.buffer) {
      throw new Error('No file provided or invalid file format');
    }

    this.logger.log(`Storing image as Base64 (Size: ${file.size} bytes)`);
    
    const base64 = file.buffer.toString('base64');
    const mimeType = file.mimetype || 'image/jpeg';
    return `data:${mimeType};base64,${base64}`;
  }
}
