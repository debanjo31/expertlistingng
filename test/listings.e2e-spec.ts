import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';

describe('Listings API', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const agentId = '8c6f6819-7ff2-4b59-bebf-60ee8b3fcf9b';
  const baseListing = {
    title: 'Ikoyi apartment',
    price: 5_000_000,
    type: 'rent',
    bedrooms: 2,
    location: { lat: 6.4541, lng: 3.4241 },
    agentId,
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
    dataSource = app.get(DataSource);
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE listings');
  });

  afterAll(async () => {
    await dataSource.query('TRUNCATE TABLE listings');
    await app.close();
  });

  async function createListing(overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .send({ ...baseListing, ...overrides })
      .expect(201);
    return response.body as Record<string, unknown>;
  }

  it('supports the full CRUD flow', async () => {
    const created = await createListing();

    expect(created).toMatchObject({
      title: baseListing.title,
      price: baseListing.price,
      location: baseListing.location,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/listings/${String(created.id)}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(created.id);
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/listings/${String(created.id)}`)
      .send({ title: 'Updated Ikoyi apartment' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.title).toBe('Updated Ikoyi apartment');
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/listings/${String(created.id)}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/listings/${String(created.id)}`)
      .expect(404);
  });

  it('validates payloads and rejects unknown fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .send({ ...baseListing, type: 'lease', unexpected: true })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: '/api/v1/listings',
    });
    expect(response.body.message).toEqual(
      expect.arrayContaining([
        'property unexpected should not exist',
        'type must be one of the following values: rent, sale, shortlet',
      ]),
    );
  });

  it('requires a location', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .send({
        title: baseListing.title,
        price: baseListing.price,
        type: baseListing.type,
        bedrooms: baseListing.bedrooms,
        agentId: baseListing.agentId,
      })
      .expect(400);

    expect(response.body.message).toContain(
      'location should not be null or undefined',
    );
  });

  it('returns pagination metadata', async () => {
    await createListing({ title: 'Listing one' });
    await createListing({ title: 'Listing two' });
    await createListing({ title: 'Listing three' });

    const response = await request(app.getHttpServer())
      .get('/api/v1/listings?page=1&limit=2')
      .expect(200);

    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it('filters by radius and listing attributes', async () => {
    await createListing({ title: 'Nearby rental' });
    await createListing({
      title: 'Nearby sale',
      type: 'sale',
      price: 90_000_000,
    });
    await createListing({
      title: 'Abuja rental',
      location: { lat: 9.0765, lng: 7.3986 },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/listings/search')
      .query({
        latitude: 6.5244,
        longitude: 3.3792,
        radiusKm: 20,
        type: 'rent',
        minPrice: 4_000_000,
        maxPrice: 6_000_000,
        bedrooms: 2,
      })
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0]).toMatchObject({ title: 'Nearby rental' });
    expect(response.body.data[0].distanceKm).toBeGreaterThan(0);
  });

  it('invalidates a cached search after a create', async () => {
    const query = {
      latitude: 6.5244,
      longitude: 3.3792,
      radiusKm: 20,
    };
    await request(app.getHttpServer())
      .get('/api/v1/listings/search')
      .query(query)
      .expect(200)
      .expect(({ body }) => expect(body.meta.total).toBe(0));

    await createListing({ title: 'Newly available home' });

    await request(app.getHttpServer())
      .get('/api/v1/listings/search')
      .query(query)
      .expect(200)
      .expect(({ body }) => expect(body.meta.total).toBe(1));
  });
});
