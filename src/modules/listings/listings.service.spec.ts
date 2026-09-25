import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { RedisService } from '../../redis/redis.service';
import { Listing } from './entities/listing.entity';
import { ListingType } from './listing-type.enum';
import { ListingsService } from './listings.service';

describe('ListingsService', () => {
  type RepositoryMock = {
    create: jest.Mock;
    save: jest.Mock;
    findAndCount: jest.Mock;
    findOneBy: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  type RedisMock = {
    getJson: jest.Mock;
    setJson: jest.Mock;
    getSearchVersion: jest.Mock;
    incrementSearchVersion: jest.Mock;
  };

  let service: ListingsService;
  let repository: RepositoryMock;
  let redis: RedisMock;

  const listing = (): Listing => ({
    id: '3ff8f5e5-3b43-49f2-aafb-b124d6c46c65',
    title: 'Two bedroom apartment',
    price: 5_000_000,
    type: ListingType.RENT,
    bedrooms: 2,
    location: { type: 'Point', coordinates: [3.3792, 6.5244] },
    agentId: '8c6f6819-7ff2-4b59-bebf-60ee8b3fcf9b',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  beforeEach(async () => {
    const repositoryMock = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
      findOneBy: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const redisMock = {
      getJson: jest.fn(),
      setJson: jest.fn(),
      getSearchVersion: jest.fn().mockResolvedValue('0'),
      incrementSearchVersion: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        ListingsService,
        {
          provide: getRepositoryToken(Listing),
          useValue: repositoryMock,
        },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get(ListingsService);
    repository = module.get<RepositoryMock>(getRepositoryToken(Listing));
    redis = module.get<RedisMock>(RedisService);
  });

  it('creates a listing and invalidates cached searches', async () => {
    const entity = listing();
    repository.create.mockReturnValue(entity);
    repository.save.mockResolvedValue(entity);

    const result = await service.create({
      title: entity.title,
      price: entity.price,
      type: entity.type,
      bedrooms: entity.bedrooms,
      location: { lat: 6.5244, lng: 3.3792 },
      agentId: entity.agentId,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        location: { type: 'Point', coordinates: [3.3792, 6.5244] },
      }),
    );
    expect(redis.incrementSearchVersion).toHaveBeenCalledTimes(1);
    expect(result.location).toEqual({ lat: 6.5244, lng: 3.3792 });
  });

  it('throws when a listing does not exist', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(
      service.findOne('3ff8f5e5-3b43-49f2-aafb-b124d6c46c65'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('updates a listing and invalidates cached searches', async () => {
    const entity = listing();
    repository.findOneBy.mockResolvedValue(entity);
    repository.save.mockResolvedValue(entity);

    const result = await service.update(entity.id, { price: 6_000_000 });

    expect(result.price).toBe(6_000_000);
    expect(redis.incrementSearchVersion).toHaveBeenCalledTimes(1);
  });

  it('throws when deleting an unknown listing', async () => {
    repository.delete.mockResolvedValue({ affected: 0, raw: [] });

    await expect(
      service.remove('3ff8f5e5-3b43-49f2-aafb-b124d6c46c65'),
    ).rejects.toMatchObject({ status: 404 });
    expect(redis.incrementSearchVersion).not.toHaveBeenCalled();
  });

  it('rejects an inverted price range before querying storage', async () => {
    await expect(
      service.search({
        latitude: 6.5244,
        longitude: 3.3792,
        radiusKm: 10,
        minPrice: 10,
        maxPrice: 5,
        page: 1,
        limit: 20,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('returns a cached search without querying PostgreSQL', async () => {
    const cached = {
      data: [
        {
          id: listing().id,
          title: listing().title,
          price: listing().price,
          type: listing().type,
          bedrooms: listing().bedrooms,
          location: { lat: 6.5244, lng: 3.3792 },
          agentId: listing().agentId,
          createdAt: listing().createdAt,
          updatedAt: listing().updatedAt,
          distanceKm: 1.2,
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    redis.getJson.mockResolvedValue(cached);

    const result = await service.search({
      latitude: 6.5244,
      longitude: 3.3792,
      radiusKm: 10,
      page: 1,
      limit: 20,
    });

    expect(result).toEqual(cached);
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
