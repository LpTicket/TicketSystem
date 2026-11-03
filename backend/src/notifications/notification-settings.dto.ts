import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, Min, ValidateNested } from 'class-validator';
import { NOTIFICATION_CATALOG } from './notification-catalog';
import type { NotificationKey } from './notification-catalog';

class NotificationChangeDto {
  @IsIn(NOTIFICATION_CATALOG.map((item) => item.key))
  key: NotificationKey;

  @IsBoolean()
  @Transform(({ obj }: { obj: { enabled: unknown } }) => obj.enabled, { toClassOnly: true })
  enabled: boolean;
}

export class UpdateNotificationSettingsDto {
  @IsInt()
  @Min(1)
  version: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(NOTIFICATION_CATALOG.length)
  @ArrayUnique((item: NotificationChangeDto) => item?.key)
  @ValidateNested({ each: true })
  @Type(() => NotificationChangeDto)
  changes: NotificationChangeDto[];
}
