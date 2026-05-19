export type LocationRecord = {
  id: number;
  store_name: string;
  category: string;
  address: string;
   state?: string;
  latitude: number;
  longitude: number;
  opening_hours: string;
  contact: string | null;
  google_maps_link: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  distance_km?: number;
};
