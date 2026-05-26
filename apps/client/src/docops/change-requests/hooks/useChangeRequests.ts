import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  addExternalRef,
  createChangeRequest,
  getChangeRequest,
  listChangeRequests,
  removeExternalRef,
  transitionChangeRequest,
} from "../api/change-requests.api";
import type {
  AddExternalRefPayload,
  ChangeRequest,
  CrListResponse,
  ListCrParams,
  TransitionCrPayload,
} from "../types/cr.types";

export function useChangeRequestsQuery(params: ListCrParams) {
  return useQuery<CrListResponse>({
    queryKey: ["change-requests", params],
    queryFn: () => listChangeRequests(params),
    placeholderData: (prev) => prev,
  });
}

export function useCrQuery(id: string | undefined) {
  return useQuery<ChangeRequest>({
    queryKey: ["change-request", id],
    queryFn: () => getChangeRequest(id!),
    enabled: !!id,
  });
}

export function useCreateCrMutation() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createChangeRequest,
    onSuccess: (cr) => {
      qc.invalidateQueries({ queryKey: ["change-requests"] });
      navigate(`/change-requests/${cr.id}`);
    },
  });
}

export function useTransitionMutation(crId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransitionCrPayload) => transitionChangeRequest(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-request", crId] });
      qc.invalidateQueries({ queryKey: ["cr-transitions", crId] });
      qc.invalidateQueries({ queryKey: ["change-requests"] });
      qc.invalidateQueries({ queryKey: ["service-lock"] });
    },
  });
}

export function useAddExternalRefMutation(crId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddExternalRefPayload) => addExternalRef(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-request", crId] });
    },
  });
}

export function useRemoveExternalRefMutation(crId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeExternalRef(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-request", crId] });
    },
  });
}
