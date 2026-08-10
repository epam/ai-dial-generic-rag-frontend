/** A single DIAL theme resolved from the themes config service. */
export interface Theme {
  id: string;
  displayName: string;
  colors: Record<string, string>;
}
