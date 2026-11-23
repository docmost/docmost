import {
  getEmbedProviderById,
  getEmbedUrlAndProvider,
} from "@docmost/editor-ext";
import { describe, expect, it } from "vitest";

const ID = "1aBc-D_eFgHiJkLmNoPqRsTuVwXyZ012";
const PUB = "2PACX-1vQaBc-D_eFgHiJkLmNoP";

describe("Google Drive embed", () => {
  const googleDrive = getEmbedProviderById("gdrive");

  it.each([
    `https://docs.google.com/document/d/${ID}/edit`,
    `https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing`,
    `https://docs.google.com/presentation/d/${ID}/edit?usp=sharing`,
    `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
    `https://docs.google.com/document/d/${ID}`,
    `https://docs.google.com/document/u/1/d/${ID}/edit`,
    `https://docs.google.com/presentation/d/e/${PUB}/pub?start=false`,
  ])("accepts %s", (url) => {
    expect(googleDrive.regex.test(url)).toBe(true);
  });

  it.each([
    `https://docs.google.com/forms/d/${ID}/viewform`,
    `https://drive.google.com/drive/folders/${ID}`,
    `https://docs.google.com.example.com/document/d/${ID}/edit`,
    `https://example.com/document/d/${ID}/edit`,
  ])("rejects %s", (url) => {
    expect(googleDrive.regex.test(url)).toBe(false);
  });

  it.each([
    [
      `https://docs.google.com/document/d/${ID}/edit?usp=sharing`,
      `https://docs.google.com/document/d/${ID}/preview`,
    ],
    [
      `https://docs.google.com/spreadsheets/d/${ID}/edit?gid=42#gid=42`,
      `https://docs.google.com/spreadsheets/d/${ID}/preview#gid=42`,
    ],
    [
      `https://docs.google.com/presentation/d/${ID}/edit#slide=id.p3`,
      `https://docs.google.com/presentation/d/${ID}/preview#slide=id.p3`,
    ],
    [
      `https://docs.google.com/document/u/1/d/${ID}/edit`,
      `https://docs.google.com/document/d/${ID}/preview`,
    ],
    [
      `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
      `https://drive.google.com/file/d/${ID}/preview`,
    ],
    [
      `https://drive.google.com/file/d/${ID}/view?usp=sharing&resourcekey=0-AbC_d`,
      `https://drive.google.com/file/d/${ID}/preview?resourcekey=0-AbC_d`,
    ],
  ])("previews %s", (url, embedUrl) => {
    expect(getEmbedUrlAndProvider(url).embedUrl).toBe(embedUrl);
  });

  it.each([
    `https://docs.google.com/document/d/e/${PUB}/pub`,
    `https://docs.google.com/document/d/${ID}/pub`,
    `https://docs.google.com/spreadsheets/d/e/${PUB}/pubhtml?widget=true&headers=false`,
    `https://docs.google.com/presentation/d/e/${PUB}/embed?start=false&loop=false&delayms=3000`,
  ])("keeps the published link %s", (url) => {
    expect(getEmbedUrlAndProvider(url).embedUrl).toBe(url);
  });

  it("swaps a published presentation's /pub page, which Google refuses to frame, for /embed", () => {
    expect(
      getEmbedUrlAndProvider(
        `https://docs.google.com/presentation/d/e/${PUB}/pub?start=false&loop=false&delayms=3000`,
      ).embedUrl,
    ).toBe(
      `https://docs.google.com/presentation/d/e/${PUB}/embed?start=false&loop=false&delayms=3000`,
    );
  });

  it("keeps accepting Sheets links in embeds saved with the old Google Sheets option", () => {
    expect(
      getEmbedProviderById("gsheets").regex.test(
        `https://docs.google.com/spreadsheets/d/${ID}/edit`,
      ),
    ).toBe(true);
  });
});

describe("YouTube embed links", () => {
  const id = "aBcDeFgHiJk";
  const watch = `https://www.youtube.com/watch?v=${id}`;

  it.each([
    [`https://www.youtube-nocookie.com/embed/${id}`, watch],
    [`https://www.youtube.com/embed/${id}`, watch],
    [`https://www.youtube.com/embed/${id}#t=1m15s`, `${watch}&t=1m15s`],
    [
      `https://www.youtube-nocookie.com/embed/${id}?start=75&list=PL123&index=2&controls=0`,
      `${watch}&list=PL123&index=2&t=75`,
    ],
    [
      "https://www.youtube-nocookie.com/embed/videoseries?list=PL123",
      "https://www.youtube.com/playlist?list=PL123",
    ],
    [
      "https://www.youtube.com/embed/live_stream?channel=UC123",
      "https://www.youtube.com/channel/UC123/live",
    ],
  ])("keeps %s in the frame and opens its public page", (src, linkUrl) => {
    expect(getEmbedUrlAndProvider(src)).toMatchObject({
      embedUrl: src,
      linkUrl,
      providerId: "youtube",
      label: "YouTube",
    });
  });

  it.each([`${watch}&t=75s`, `https://youtu.be/${id}?t=75`])(
    "keeps the original share link for %s",
    (url) => {
      expect(getEmbedUrlAndProvider(url)).toMatchObject({
        providerId: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
        linkUrl: url,
      });
    },
  );

  it.each([
    ["https://www.loom.com/share/abc123", "loom"],
    [`https://youtube-nocookie.com.example.com/embed/${id}`, "iframe"],
  ])("keeps the original link for other hosts such as %s", (url, providerId) => {
    expect(getEmbedUrlAndProvider(url)).toMatchObject({
      providerId,
      linkUrl: url,
    });
  });
});

describe("embed label", () => {
  it.each([
    [`https://docs.google.com/document/d/${ID}/edit`, "gdrive", "Google Docs"],
    [`https://docs.google.com/spreadsheets/d/${ID}/edit`, "gdrive", "Google Sheets"],
    [`https://docs.google.com/presentation/d/e/${PUB}/pub`, "gdrive", "Google Slides"],
    [`https://drive.google.com/file/d/${ID}/view`, "gdrive", "Google Drive"],
    ["https://www.youtube.com/watch?v=aBcDeFgHiJk", "youtube", "YouTube"],
    ["https://www.example.com/widgets/chart?id=7", "iframe", "example.com"],
    ["not a url", "iframe", "Iframe"],
  ])("labels %s", (url, providerId, label) => {
    expect(getEmbedUrlAndProvider(url)).toMatchObject({ providerId, label });
  });
});
