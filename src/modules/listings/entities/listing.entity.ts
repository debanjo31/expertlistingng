import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ListingType } from '../listing-type.enum';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

const numericTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => Number(value),
};

@Entity({ name: 'listings' })
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 0,
    transformer: numericTransformer,
  })
  price: number;

  @Column({ type: 'enum', enum: ListingType, enumName: 'listing_type' })
  type: ListingType;

  @Column({ type: 'smallint' })
  bedrooms: number;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: GeoPoint;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
