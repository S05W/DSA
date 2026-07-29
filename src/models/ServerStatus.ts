export interface ServerStatus {
  sampledAt: string;
  hostname: string;
  platform: string;
  nodeVersion: string;
  uptimeSeconds: number;
  cpu: {
    usagePercent: number;
    coreCount: number;
    load1: number;
    load5: number;
    load15: number;
  };
  memory: {
    usedBytes: number;
    totalBytes: number;
    usagePercent: number;
  };
  storage: {
    usedBytes: number;
    totalBytes: number;
    usagePercent: number;
  };
  process: {
    memoryBytes: number;
    uptimeSeconds: number;
  };
  databaseBytes: number;
  temperatureC: number | null;
}
