import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { CreateServicePayload, ListServicesParams, UpdateServicePayload } from "../types/service.types";
import { createService, getService, listServices, listTags, updateService } from "../api/services.api";

export function useServicesQuery(params?: ListServicesParams) {
  return useQuery({
    queryKey: ["services", params],
    queryFn: () => listServices(params),
    placeholderData: keepPreviousData,
  });
}

export function useServiceQuery(code: string) {
  return useQuery({
    queryKey: ["service", code],
    queryFn: () => getService(code),
    enabled: !!code,
  });
}

export function useTagsQuery() {
  return useQuery({
    queryKey: ["service-tags"],
    queryFn: listTags,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateServiceMutation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: CreateServicePayload) => createService(payload),
    onSuccess: (service) => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      navigate(`/services/${service.code}`);
    },
  });
}

export function useUpdateServiceMutation(code: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateServicePayload }) =>
      updateService(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service", code] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}
