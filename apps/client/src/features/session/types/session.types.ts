export type ISession = {
  id: string;
  deviceName: string | null;
  geoLocation: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrentDevice?: boolean;
};
