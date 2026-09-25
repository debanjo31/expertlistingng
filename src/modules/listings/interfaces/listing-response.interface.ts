import { ListingType } from '../listing-type.enum';

export interface ListingResponse {
  id: string;
  title: string;
  price: number;
  type: ListingType;
  bedrooms: number;
  location: {
    lat: number;
    lng: number;
  };
  agentId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchListingResponse extends ListingResponse {
  distanceKm: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
