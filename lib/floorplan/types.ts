export interface FloorplanDesignRow {
  id: string;
  furniture_type: string;
  name: string | null;
  params: Record<string, unknown>;
  updated_at: string;
}

export interface RoomDimensions {
  lengthMm: number;
  widthMm: number;
}

export interface PlacedItem {
  id: string;
  designId: string;
  furnitureType: string;
  name: string;
  xMm: number;
  yMm: number;
  rotation: 0 | 90 | 180 | 270;
  footprintMm: { length: number; width: number };
}
