import { afterEach, describe, expect, it } from "vitest";
import {
  findRegisteredIntegrationResource,
  getRegisteredIntegrationIds,
  getRegisteredIntegrationResources,
  matchIntegrationEmbedText,
  setRegisteredIntegrationCatalog,
} from "./integration-resource-registry";
import { IntegrationListItem } from "@/features/integrations/types/integration.types";

function catalog(overrides: Partial<IntegrationListItem> = {}): IntegrationListItem[] {
  return [
    {
      id: "windshift:1111",
      name: "Windshift",
      baseUrl: "https://ws.example.com/",
      resources: [
        {
          id: "item",
          title: "Windshift item",
          renderKind: "item-card",
          searchTerms: [],
          urlPatterns: [
            {
              pattern: "/workspaces/\\d+/items/(?<id>\\d+)",
              resourceKey: "id:{id}",
            },
          ],
        },
      ],
      ...overrides,
    } as IntegrationListItem,
  ];
}

afterEach(() => {
  setRegisteredIntegrationCatalog([]);
});

describe("integration resource registry", () => {
  it("flattens resources with their integration identity", () => {
    setRegisteredIntegrationCatalog(catalog());
    expect([...getRegisteredIntegrationIds()]).toEqual(["windshift:1111"]);
    const resources = getRegisteredIntegrationResources();
    expect(resources).toHaveLength(1);
    expect(resources[0]).toMatchObject({
      id: "item",
      integrationId: "windshift:1111",
      integrationName: "Windshift",
    });
    expect(findRegisteredIntegrationResource("windshift:1111", "item")?.title).toBe(
      "Windshift item",
    );
    expect(findRegisteredIntegrationResource("windshift:1111", "nope")).toBeUndefined();
  });
});

describe("matchIntegrationEmbedText", () => {
  it("converts a pasted provider URL (plus trailing space) into embed attrs", () => {
    setRegisteredIntegrationCatalog(catalog());
    const match = matchIntegrationEmbedText(
      "https://ws.example.com/workspaces/2/items/7 ",
    );
    expect(match).not.toBeNull();
    expect(match!.data).toEqual({
      integrationId: "windshift:1111",
      resourceId: "item",
      resourceKey: "id:7",
      renderKind: "item-card",
    });
    expect(match!.text).toBe("https://ws.example.com/workspaces/2/items/7 ");
  });

  it("requires the trailing-space paste trigger", () => {
    setRegisteredIntegrationCatalog(catalog());
    expect(
      matchIntegrationEmbedText("https://ws.example.com/workspaces/2/items/7"),
    ).toBeNull();
  });

  it("ignores URLs from other hosts", () => {
    setRegisteredIntegrationCatalog(catalog());
    expect(
      matchIntegrationEmbedText("https://evil.example.com/workspaces/2/items/7 "),
    ).toBeNull();
  });

  it("does not let the base URL act as a regex", () => {
    setRegisteredIntegrationCatalog(catalog({ baseUrl: "https://ws.example.com" }));
    expect(
      matchIntegrationEmbedText("https://wsXexampleYcom/workspaces/2/items/7 "),
    ).toBeNull();
  });

  it("skips integrations without a base URL and returns null when nothing matches", () => {
    setRegisteredIntegrationCatalog(catalog({ baseUrl: undefined }));
    expect(
      matchIntegrationEmbedText("https://ws.example.com/workspaces/2/items/7 "),
    ).toBeNull();
    setRegisteredIntegrationCatalog([]);
    expect(matchIntegrationEmbedText("anything ")).toBeNull();
  });
});
