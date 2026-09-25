import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateListingDto } from './dto/create-listing.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { SearchListingsQueryDto } from './dto/search-listings-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import {
  ListingResponse,
  PaginatedResponse,
  SearchListingResponse,
} from './interfaces/listing-response.interface';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  create(@Body() dto: CreateListingDto): Promise<ListingResponse> {
    return this.listingsService.create(dto);
  }

  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ListingResponse>> {
    return this.listingsService.findAll(query);
  }

  @Get('search')
  search(
    @Query() query: SearchListingsQueryDto,
  ): Promise<PaginatedResponse<SearchListingResponse>> {
    return this.listingsService.search(query);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ListingResponse> {
    return this.listingsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateListingDto,
  ): Promise<ListingResponse> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }
    return this.listingsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.listingsService.remove(id);
  }
}
