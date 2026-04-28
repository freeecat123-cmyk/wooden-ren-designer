export interface DesignRow {
  id: string;
  furniture_type: string;
  name: string | null;
  params: Record<string, unknown>;
}
