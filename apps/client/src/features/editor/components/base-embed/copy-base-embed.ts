import { notifications } from "@mantine/notifications";
import i18n from "@/i18n.ts";
import { getAppUrl } from "@/lib/config.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { IPage } from "@/features/page/types/page.types.ts";

// Pastes into a page as an embed of the same base; other apps get its link.
export async function copyBaseEmbed(page: IPage): Promise<void> {
  const url =
    getAppUrl() + buildPageUrl(page.space?.slug, page.slugId, page.title);

  const embed = document.createElement("div");
  embed.setAttribute("data-type", "base-embed");
  embed.setAttribute("data-page-id", page.id);
  const link = embed.appendChild(document.createElement("a"));
  link.href = url;
  link.textContent = page.title || i18n.t("Untitled base");
  const html = embed.outerHTML;

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([url], { type: "text/plain" }),
      }),
    ]);
  } catch {
    // Insecure contexts have no async clipboard, but a copy event can still carry HTML.
    let copied = false;
    const onCopy = (event: ClipboardEvent) => {
      event.preventDefault();
      event.clipboardData?.setData("text/html", html);
      event.clipboardData?.setData("text/plain", url);
      copied = true;
    };
    document.addEventListener("copy", onCopy);
    document.execCommand("copy");
    document.removeEventListener("copy", onCopy);

    if (!copied) {
      notifications.show({ color: "red", message: i18n.t("Failed to copy") });
      return;
    }
  }

  notifications.show({
    message: i18n.t("Copied. Paste on any page to embed this base."),
  });
}
