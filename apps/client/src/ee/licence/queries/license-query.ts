import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  activateLicense,
  removeLicense,
  getLicenseInfo,
} from "@/ee/licence/services/license-service.ts";
import { ILicenseInfo } from "@/ee/licence/types/license.types.ts";
import { notifications } from "@mantine/notifications";

export function useLicenseInfo(): UseQueryResult<ILicenseInfo, Error> {
  return useQuery({
    queryKey: ["license"],
    queryFn: () => getLicenseInfo(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useActivateMutation() {
  const queryClient = useQueryClient();

  return useMutation<ILicenseInfo, Error, string>({
    mutationFn: (licenseKey) => activateLicense(licenseKey),
    onSuccess: () => {
      notifications.show({ message: "License activated successfully" });
      queryClient.refetchQueries({
        queryKey: ["license"],
      });
      queryClient.refetchQueries({ queryKey: ["currentUser"] });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useRemoveLicenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => removeLicense(),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["license"] });
      queryClient.refetchQueries({ queryKey: ["currentUser"] });
    },
  });
}
