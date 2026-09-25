import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ListingType } from '../listing-type.enum';
import { LocationDto } from './location.dto';

export const MAX_PRICE = 999_999_999_999_999;

export class CreateListingDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  price: number;

  @IsEnum(ListingType)
  type: ListingType;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  bedrooms: number;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @IsUUID()
  agentId: string;
}
