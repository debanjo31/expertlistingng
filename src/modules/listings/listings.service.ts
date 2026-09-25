import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { SearchListingsQueryDto } from './dto/search-listings-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { GeoPoint, Listing } from './entities/listing.entity';
import {
  ListingResponse,
  PaginatedResponse,
  SearchListingResponse,
} from './interfaces/listing-response.interface';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateListingDto): Promise<ListingResponse> {
    const listing = this.listingsRepository.create({
      ...dto,
      location: this.toPoint(dto.location.lat, dto.location.lng),
    });
    const saved = await this.listingsRepository.save(listing);
    await this.redis.incrementSearchVersion();
    return this.toResponse(saved);
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ListingResponse>> {
    const [listings, total] = await this.listingsRepository.findAndCount({
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return this.paginate(
      listings.map((listing) => this.toResponse(listing)),
      total,
      query,
    );
  }

  async search(
    query: SearchListingsQueryDto,
  ): Promise<PaginatedResponse<SearchListingResponse>> {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException(
        'minPrice must be less than or equal to maxPrice',
      );
    }

    const cacheKey = await this.searchCacheKey(query);
    const cached =
      await this.redis.getJson<PaginatedResponse<SearchListingResponse>>(
        cacheKey,
      );
    if (cached) {
      return cached;
    }

    const pointSql =
      'ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography';
    const builder = this.listingsRepository
      .createQueryBuilder('listing')
      .addSelect(
        `ST_Distance(listing.location, ${pointSql}) / 1000`,
        'distance_km',
      )
      .where(`ST_DWithin(listing.location, ${pointSql}, :radiusMeters)`, {
        latitude: query.latitude,
        longitude: query.longitude,
        radiusMeters: query.radiusKm * 1000,
      });

    if (query.type !== undefined) {
      builder.andWhere('listing.type = :type', { type: query.type });
    }
    if (query.minPrice !== undefined) {
      builder.andWhere('listing.price >= :minPrice', {
        minPrice: query.minPrice,
      });
    }
    if (query.maxPrice !== undefined) {
      builder.andWhere('listing.price <= :maxPrice', {
        maxPrice: query.maxPrice,
      });
    }
    if (query.bedrooms !== undefined) {
      builder.andWhere('listing.bedrooms = :bedrooms', {
        bedrooms: query.bedrooms,
      });
    }

    const total = await builder.getCount();
    const { entities, raw } = await builder
      .orderBy('distance_km', 'ASC')
      .addOrderBy('listing.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getRawAndEntities<{ distance_km: string }>();

    const data = entities.map((listing, index) => ({
      ...this.toResponse(listing),
      distanceKm: Number(Number(raw[index].distance_km).toFixed(3)),
    }));
    const response = this.paginate(data, total, query);
    await this.redis.setJson(cacheKey, response);
    return response;
  }

  async findOne(id: string): Promise<ListingResponse> {
    return this.toResponse(await this.findEntity(id));
  }

  async update(id: string, dto: UpdateListingDto): Promise<ListingResponse> {
    const listing = await this.findEntity(id);
    const { location, ...fields } = dto;
    Object.assign(listing, fields);
    if (location) {
      listing.location = this.toPoint(location.lat, location.lng);
    }

    const saved = await this.listingsRepository.save(listing);
    await this.redis.incrementSearchVersion();
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.listingsRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Listing ${id} was not found`);
    }
    await this.redis.incrementSearchVersion();
  }

  private async findEntity(id: string): Promise<Listing> {
    const listing = await this.listingsRepository.findOneBy({ id });
    if (!listing) {
      throw new NotFoundException(`Listing ${id} was not found`);
    }
    return listing;
  }

  private toPoint(lat: number, lng: number): GeoPoint {
    return { type: 'Point', coordinates: [lng, lat] };
  }

  private toResponse(listing: Listing): ListingResponse {
    return {
      id: listing.id,
      title: listing.title,
      price: listing.price,
      type: listing.type,
      bedrooms: listing.bedrooms,
      location: {
        lat: listing.location.coordinates[1],
        lng: listing.location.coordinates[0],
      },
      agentId: listing.agentId,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  }

  private paginate<T>(
    data: T[],
    total: number,
    query: PaginationQueryDto,
  ): PaginatedResponse<T> {
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private async searchCacheKey(query: SearchListingsQueryDto): Promise<string> {
    const version = await this.redis.getSearchVersion();
    const normalized = {
      latitude: query.latitude,
      longitude: query.longitude,
      radiusKm: query.radiusKm,
      type: query.type ?? null,
      minPrice: query.minPrice ?? null,
      maxPrice: query.maxPrice ?? null,
      bedrooms: query.bedrooms ?? null,
      page: query.page,
      limit: query.limit,
    };
    const hash = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
    return `listings:search:${version}:${hash}`;
  }
}
