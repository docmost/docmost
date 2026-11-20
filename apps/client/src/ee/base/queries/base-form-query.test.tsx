import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { FormConfig, IBaseView } from "@/ee/base/types/base.types";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("@/ee/base/services/base-service", () => ({ updateView: vi.fn() }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { queryClient } from "@/main.tsx";
import { updateView } from "@/ee/base/services/base-service";
import { notifications } from "@mantine/notifications";
import { useUpdateFormConfig } from "./base-form-query";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

afterEach(() => {
  cleanup();
  queryClient.clear();
});

it("sends the form each edit started from, including the preceding queued edit", async () => {
  const view = (form: FormConfig) => ({ id: "view", config: { form } }) as IBaseView;
  const original = { title: "First title", fields: [{ propertyId: "name" }] };
  queryClient.setQueryData(["bases", "page"], { views: [view(original)] });
  let finishFirst: (view: IBaseView) => void;
  vi.mocked(updateView)
    .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
    .mockImplementationOnce(async (input) => view(input.config.form));
  const { result } = renderHook(() => useUpdateFormConfig("page", "view"), { wrapper });

  act(() => {
    result.current((form) => ({ ...form, title: "New title" }));
    result.current((form) => ({ ...form, submitLabel: "Send" }));
  });
  const renamed = { ...original, title: "New title" };
  await waitFor(() => expect(updateView).toHaveBeenNthCalledWith(1,
    expect.objectContaining({ expectedForm: original, config: { form: renamed } }),
  ));
  await act(async () => finishFirst(view(renamed)));
  await waitFor(() => expect(updateView).toHaveBeenNthCalledWith(2,
    expect.objectContaining({
      expectedForm: renamed, config: { form: { ...renamed, submitLabel: "Send" } },
    }),
  ));
});

it("reloads the saved questions after a competing edit and tells the editor to retry", async () => {
  const key = ["bases", "page"];
  const previous = { views: [{ id: "view", config: { form: { fields: [] } } }] };
  const saved = {
    views: [{ id: "view", config: { form: { fields: [{ propertyId: "name", required: true }] } } }],
  };
  queryClient.setQueryData(key, previous);
  vi.mocked(updateView).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } });
  const { result } = renderHook(() => ({
    base: useQuery({ queryKey: key, queryFn: async () => saved, staleTime: Infinity }).data,
    update: useUpdateFormConfig("page", "view"),
  }), { wrapper });
  act(() => result.current.update((form) => ({ ...form, fields: [{ propertyId: "email" }] })));
  await waitFor(() => expect(result.current.base).toEqual(saved));
  expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
    message: "The form changed. Reload it and try again.",
  }));
});
