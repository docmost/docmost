import api from "@/lib/api-client";
import {
  ISiemDestination,
  ISiemDestinationInput,
  ISiemTestResult,
  ITestSiemDestinationInput,
  IUpdateSiemDestinationInput,
} from "@/ee/siem/types/siem.types";

export async function getSiemDestinations(): Promise<ISiemDestination[]> {
  const req = await api.post<ISiemDestination[]>("/siem/destinations");
  return req.data;
}

export async function createSiemDestination(
  data: ISiemDestinationInput,
): Promise<ISiemDestination> {
  const req = await api.post<ISiemDestination>("/siem/destinations/create", data);
  return req.data;
}

export async function updateSiemDestination(
  data: IUpdateSiemDestinationInput,
): Promise<ISiemDestination> {
  const req = await api.post<ISiemDestination>("/siem/destinations/update", data);
  return req.data;
}

export async function deleteSiemDestination(data: {
  destinationId: string;
}): Promise<void> {
  await api.post("/siem/destinations/delete", data);
}

export async function testSiemDestination(
  data: ITestSiemDestinationInput,
): Promise<ISiemTestResult> {
  const req = await api.post<ISiemTestResult>("/siem/destinations/test", data);
  return req.data;
}

export async function retrySiemDestination(data: {
  destinationId: string;
}): Promise<void> {
  await api.post("/siem/destinations/retry", data);
}
