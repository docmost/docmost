import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    Container,
    Paper,
    Title,
    Text,
    Select,
    Button,
    Group,
    Loader,
    Stack,
    Textarea,
    TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import { useGetRootSidebarPagesQuery } from "@/features/page/queries/page-query";
import api from "@/lib/api-client"; // Direct axios usage for FormData

export default function ShareTarget() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    const [sharedData, setSharedData] = useState<{
        title: string;
        text: string;
        url: string;
    } | null>(null);
    const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
    const [selectedParentPage, setSelectedParentPage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(true);
    const [isImporting, setIsImporting] = useState(false);

    // Fetch spaces to allow selection
    const { data: spacesData, isLoading: isLoadingSpaces } = useGetSpacesQuery({
        limit: 100, // Fetch enough spaces
    });

    // Fetch potential parent pages when space is selected
    const { data: pagesData } = useGetRootSidebarPagesQuery({
        spaceId: selectedSpace || "",
    });

    useEffect(() => {
        const loadSharedContent = async () => {
            try {
                // 1. Try to get data from SW Cache
                const cache = await caches.open("share-target");
                const cachedResponse = await cache.match("shared-content");

                if (cachedResponse) {
                    const data = await cachedResponse.json();
                    setSharedData({
                        title: data.title || "",
                        text: data.text || "",
                        url: data.url || "",
                    });
                    await cache.delete("shared-content");
                } else {
                    // 2. Fallback to URL query params (GET method support)
                    const params = new URLSearchParams(location.search);
                    const title = params.get("title") || "";
                    const text = params.get("text") || "";
                    const url = params.get("url") || "";

                    if (title || text || url) {
                        setSharedData({ title, text, url });
                    }
                }
            } catch (error) {
                console.error("Error loading shared content:", error);
                notifications.show({
                    message: t("Failed to load shared content"),
                    color: "red",
                });
            } finally {
                setIsProcessing(false);
            }
        };

        loadSharedContent();
    }, [location.search, t]);

    const handleImport = async () => {
        if (!selectedSpace || !sharedData) return;

        setIsImporting(true);
        try {
            const markdownContent = `
${sharedData.title ? `# ${sharedData.title}\n` : ""}
${sharedData.text}

${sharedData.url ? `\n---\nSource URL: ${sharedData.url}` : ""}
      `.trim();

            const blob = new Blob([markdownContent], { type: "text/markdown" });
            const formData = new FormData();
            formData.append("file", blob, "shared_page.md");
            formData.append("spaceId", selectedSpace);
            if (selectedParentPage) {
                formData.append("parentPageId", selectedParentPage);
            }

            const response = await api.post("/pages/import", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            const newPage = response.data;

            notifications.show({
                message: t("Page created successfully"),
            });

            // Redirect to the new page
            if (newPage?.slugId) {
                navigate(`/s/${newPage.spaceId}/p/${newPage.slugId}`);
            } else {
                // Fallback redirect
                navigate("/home");
            }

        } catch (error: any) {
            console.error("Import failed:", error);
            notifications.show({
                message: error?.response?.data?.message || t("Failed to create page"),
                color: "red",
            });
        } finally {
            setIsImporting(false);
        }
    };

    if (isProcessing || isLoadingSpaces) {
        return (
            <Container size="xs" mt="xl">
                <Stack align="center">
                    <Loader />
                    <Text>{t("Processing shared content...")}</Text>
                </Stack>
            </Container>
        );
    }

    if (!sharedData && !isProcessing) {
        return (
            <Container size="xs" mt="xl">
                <Paper withBorder p="md" radius="md">
                    <Text ta="center">{t("No content to share found.")}</Text>
                    <Group justify="center" mt="md">
                        <Button onClick={() => navigate("/home")}>{t("Go Home")}</Button>
                    </Group>
                </Paper>
            </Container>
        )
    }

    const spaceOptions =
        spacesData?.items?.map((space) => ({
            value: space.id,
            label: space.name,
        })) || [];

    const pageOptions =
        pagesData?.pages?.flatMap(page => page.items)?.map((page) => ({
            value: page.id,
            label: page.title,
        })) || [];

    return (
        <Container size="sm" mt="xl">
            <Paper withBorder p="xl" radius="md">
                <Title order={3} mb="lg">
                    {t("Save to Docmost")}
                </Title>

                <Stack gap="md">
                    <Select
                        label={t("Select Space")}
                        placeholder={t("Choose a space")}
                        data={spaceOptions}
                        value={selectedSpace}
                        onChange={(val) => {
                            setSelectedSpace(val);
                            setSelectedParentPage(null);
                        }}
                        required
                        searchable
                    />

                    <Select
                        label={t("Select Parent Page (Optional)")}
                        placeholder={t("Choose a parent page")}
                        data={pageOptions}
                        value={selectedParentPage}
                        onChange={setSelectedParentPage}
                        disabled={!selectedSpace}
                        searchable
                        clearable
                    />

                    <TextInput
                        label={t("Page Title")}
                        value={sharedData?.title || ""}
                        onChange={(e) =>
                            setSharedData((prev) => (prev ? { ...prev, title: e.target.value } : null))
                        }
                    />

                    <Textarea
                        label={t("Content")}
                        value={sharedData?.text || ""}
                        onChange={(e) =>
                            setSharedData((prev) => (prev ? { ...prev, text: e.target.value } : null))
                        }
                        autosize
                        minRows={4}
                        maxRows={10}
                    />

                    {sharedData?.url && (
                        <TextInput
                            label={t("Source URL")}
                            value={sharedData.url}
                            readOnly
                            variant="filled"
                        />
                    )}

                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={() => navigate("/home")}>
                            {t("Cancel")}
                        </Button>
                        <Button
                            onClick={handleImport}
                            loading={isImporting}
                            disabled={!selectedSpace}
                        >
                            {t("Save Page")}
                        </Button>
                    </Group>
                </Stack>
            </Paper>
        </Container>
    );
}
