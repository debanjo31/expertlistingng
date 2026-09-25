import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1727200000000 implements MigrationInterface {
  name = 'InitialSchema1727200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await queryRunner.query(
      "CREATE TYPE listing_type AS ENUM ('rent', 'sale', 'shortlet')",
    );
    await queryRunner.query(`
      CREATE TABLE listings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title varchar(150) NOT NULL,
        price numeric(15, 0) NOT NULL CHECK (price >= 0),
        type listing_type NOT NULL,
        bedrooms smallint NOT NULL CHECK (bedrooms >= 0),
        location geography(Point, 4326) NOT NULL,
        agent_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX listings_location_gist_idx ON listings USING GIST (location)',
    );
    await queryRunner.query(
      'CREATE INDEX listings_filters_idx ON listings (type, bedrooms, price)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE listings');
    await queryRunner.query('DROP TYPE listing_type');
  }
}
