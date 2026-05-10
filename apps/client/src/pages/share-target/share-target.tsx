import { useEffect, useState, useMemo } from "react";
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
    Combobox,
    useCombobox,
    InputBase,
    ActionIcon,
    Box,
    Center,
    ScrollArea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import { useGetRootSidebarPagesQuery, useGetSidebarPagesQuery } from "@/features/page/queries/page-query";
import api from "@/lib/api-client";
import { useDebouncedValue, useLocalStorage } from "@mantine/hooks";
import { searchPage } from "@/features/search/services/search-service";
import { IPageSearch } from "@/features/search/types/search.types";
import { IconChevronRight, IconArrowUp, IconFile, IconFolder } from "@tabler/icons-react";

export default function ShareTarget() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    // Persistent State
    const [selectedSpace, setSelectedSpace] = useLocalStorage<string | null>({
        key: "share-target-space-id",
        defaultValue: null,
    });

    const [selectedParentPage, setSelectedParentPage] = useLocalStorage<string | null>({
        key: "share-target-parent-page-id",
        defaultValue: null,
    });

    // Also persist the label so we don't show UUID on reload
    const [selectedParentPageLabel, setSelectedParentPageLabel] = useLocalStorage<string>({
        key: 'share-target-parent-page-label',
        defaultValue: ''
    });

    const [sharedData, setSharedData] = useState<{
        title: string;
        text: string;
    } | null>(null);

    const [isProcessing, setIsProcessing] = useState(true);
    const [isImporting, setIsImporting] = useState(false);

    // Search state
    const [searchValue, setSearchValue] = useState("");
    const [debouncedSearchValue] = useDebouncedValue(searchValue, 300);
    const [searchResults, setSearchResults] = useState<IPageSearch[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Navigation State for Page Selector
    const [currentNavParentId, setCurrentNavParentId] = useState<string | null>(null);

    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string, title: string }[]>([]);

    const combobox = useCombobox({
        onDropdownClose: () => {
            combobox.resetSelectedOption();
        },
    });

    // Fetch spaces
    const { data: spacesData, isLoading: isLoadingSpaces } = useGetSpacesQuery({
        limit: 100,
    });

    // Determine effective nav parent for queries
    // If we are searching, we don't use these queries for options (we use search results).

    // Query for ROOT pages (used when currentNavParentId is null)
    const { data: rootPagesData, isLoading: isLoadingRoot } = useGetRootSidebarPagesQuery({
        spaceId: selectedSpace || "",
    });

    // Query for SUB pages (used when currentNavParentId is set)
    const { data: subPagesData, isLoading: isLoadingSub } = useGetSidebarPagesQuery({
        spaceId: selectedSpace || "",
        pageId: currentNavParentId || undefined,
    });

    // Handle Search
    useEffect(() => {
        const fetchSearchResults = async () => {
            if (debouncedSearchValue && selectedSpace) {
                const trimmed = debouncedSearchValue.trim();
                if (trimmed && selectedSpace) {
                    setIsSearching(true);
                    try {
                        const results = await searchPage({
                            query: trimmed,
                            spaceId: selectedSpace,
                        });
                        setSearchResults(results);
                    } catch (error) {
                        console.error("Search failed", error);
                    } finally {
                        setIsSearching(false);
                    }
                } else {
                    setSearchResults([]);
                }
            }
        };

        fetchSearchResults();
    }, [debouncedSearchValue, selectedSpace]);

    // Handle Shared Content Loading
    useEffect(() => {
        const loadSharedContent = async () => {
            try {
                let title = "";
                let text = "";
                let url = "";
                const cache = await caches.open("share-target");
                const cachedResponse = await cache.match("shared-content");

                if (cachedResponse) {
                    const data = await cachedResponse.json();
                    title = data.title || "";
                    text = data.text || "";
                    url = data.url || "";
                    await cache.delete("shared-content");
                } else {
                    const params = new URLSearchParams(location.search);
                    title = params.get("title") || "";
                    text = params.get("text") || "";
                    url = params.get("url") || "";
                }
                let finalTitle = "";
                let finalContent = "";
                let processedText = text || "";

                // Title Logic
                if (title && title.trim()) {
                    finalTitle = title.trim();
                    // If content starts with the title, strip it to avoid duplication
                    if (processedText && processedText.trim()) {
                        const lines = processedText.split('\n');
                        // Check if first line (minus # and whitespace) matches title
                        if (lines.length > 0 && lines[0].replace(/^[\s#]+/, '').trim() === finalTitle) {
                            processedText = lines.slice(1).join('\n').trim();
                        }
                    }
                } else if (processedText && processedText.trim()) {
                    const lines = processedText.split('\n');
                    const firstNonEmptyIndex = lines.findIndex(l => l.trim().length > 0);

                    if (firstNonEmptyIndex !== -1) {
                        const line = lines[firstNonEmptyIndex];
                        // strip '#' and whitespace
                        finalTitle = line.replace(/^[\s#]+/, '').trim();

                        // use the remainder of the content as content
                        processedText = lines.slice(firstNonEmptyIndex + 1).join('\n').trim();
                    } else if (url == null || url.trim() == '') {
                        return; // Abort
                    }
                } else if (url == null || url.trim() == '') {
                    return; // Abort
                }

                // Content Logic
                // If we modified processedText above (because title was derived), we use that remainder.
                finalContent = processedText;

                // if URL is not empty, prepend it as the first line of content with 'URL: [url](url)' prefix
                if (url && url.trim()) {
                    finalContent = `URL: [${url}](${url})\n\n${finalContent}`;
                }
                if (!finalTitle && url && url.trim()) {
                    try {
                        const u = new URL(url);
                        finalTitle = u.hostname || "Shared link";
                    } catch {
                        finalTitle = "Shared link";
                    }
                }
                setSharedData({
                    title: finalTitle,
                    text: finalContent,
                });
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

    // Update label when selectedParentPage changes (if we can find it in current data)
    // This is a "best effort" label update. Ideally we'd fetch the specific page to get its title if missing.
    // For now, if we don't have the title, show the ID or nothing? 
    // We'll trust that the user selects from the list which updates the label. 
    // If loaded from localStorage, label might be "..." until we fetch it?
    // Let's rely on the list update to set label.

    // Import Logic
    const handleImport = async () => {
        if (!selectedSpace || !sharedData || isImporting) return;

        setIsImporting(true);
        try {
            const { title, text } = sharedData;

            const safeTitle = (title || "Shared page")
                .replace(/[\\\/:*?"<>|]+/g, "-")
                .trim()
                .slice(0, 120);
            const blob = new Blob([text], { type: "text/markdown" });
            const formData = new FormData();
            // Page import uses the filename as the title
            formData.append("spaceId", selectedSpace);
            formData.append("title", title);
            formData.append("file", blob, `${safeTitle}.md`);

            if (selectedParentPage) {
                formData.append("parentPageId", selectedParentPage);
            }

            const response = await api.post("/pages/import", formData);

            const newPage = response.data;

            notifications.show({
                message: t("Page created successfully"),
            });

            if (newPage?.slugId) {
                navigate(`/s/${selectedSpace}/p/${newPage.slugId}`, { replace: true });
            } else {
                navigate("/home", { replace: true });
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
                        <Button onClick={() => navigate("/home", { replace: true })}>{t("Go Home")}</Button>
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


    // Prepare displayed pages options
    let pageItems: any[] = [];
    const isLoadingPages = currentNavParentId ? isLoadingSub : isLoadingRoot;

    if (debouncedSearchValue) {
        pageItems = searchResults.map(p => ({
            id: p.id,
            title: p.title,
            hasChildren: false, // Search results usually flattened
            isSearchResult: true
        }));
    } else {
        const dataStats = currentNavParentId ? subPagesData : rootPagesData;
        if (dataStats?.pages) {
            pageItems = dataStats.pages.flatMap(page => page.items);
        }
    }

    const handleNavigateDown = (page: any) => {
        setBreadcrumbs(prev => [...prev, { id: page.id, title: page.title }]);
        setCurrentNavParentId(page.id);
        setSearchValue(""); // Clear search when navigating
    };

    const handleNavigateUp = () => {
        if (breadcrumbs.length === 0) return;
        const newBreadcrumbs = [...breadcrumbs];
        newBreadcrumbs.pop();
        setBreadcrumbs(newBreadcrumbs);

        const parent = newBreadcrumbs.length > 0 ? newBreadcrumbs[newBreadcrumbs.length - 1].id : null;
        setCurrentNavParentId(parent);
    };

    const isRoot = !currentNavParentId;

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
                            setSelectedParentPageLabel("");
                            setCurrentNavParentId(null);
                            setBreadcrumbs([]);
                            setSearchValue("");
                        }}
                        required
                        searchable
                    />

                    <Combobox
                        store={combobox}
                        onOptionSubmit={(val) => {
                            if (val === '$go_up') {
                                handleNavigateUp();
                                return;
                            }
                            // Val is pageId
                            const selectedItem = pageItems.find(p => p.id === val);
                            if (selectedItem) {
                                setSelectedParentPage(val);
                                setSelectedParentPageLabel(selectedItem.title);
                                combobox.closeDropdown();
                            } else {
                                // Maybe searched item
                                if (searchResults.some(p => p.id === val)) {
                                    const searchItem = searchResults.find(p => p.id === val);
                                    setSelectedParentPage(val);
                                    setSelectedParentPageLabel(searchItem?.title || "");
                                    combobox.closeDropdown();
                                }
                            }
                        }}
                    >
                        <Combobox.Target>
                            <InputBase
                                component="button"
                                type="button"
                                pointer
                                rightSection={<Combobox.Chevron />}
                                onClick={() => combobox.toggleDropdown()}
                                label={t("Select Parent Page (Optional)")}
                                description={t("Click 'Open' icon to browse subpages")}
                                disabled={!selectedSpace}
                                multiline
                            >
                                {selectedParentPageLabel || selectedParentPage || <Text c="dimmed">{t("Select a page...")}</Text>}
                            </InputBase>
                        </Combobox.Target>

                        <Combobox.Dropdown>
                            <Combobox.Search
                                value={searchValue}
                                onChange={(event) => setSearchValue(event.currentTarget.value)}
                                placeholder={t("Search pages...")}
                            />

                            <Combobox.Options>
                                <ScrollArea.Autosize type="scroll" mah={300}>
                                    {!isRoot && !debouncedSearchValue && (
                                        <Combobox.Option value="$go_up" style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--mantine-color-body)' }}>
                                            <Group gap="xs">
                                                <IconArrowUp size={16} />
                                                <Text size="sm" fw={500}>..</Text>
                                            </Group>
                                        </Combobox.Option>
                                    )}

                                    {(isLoadingPages || isSearching) && (
                                        <Center p="md">
                                            <Loader size="sm" />
                                        </Center>
                                    )}

                                    {!isLoadingPages && !isSearching && pageItems.length === 0 && (
                                        <Combobox.Empty>{t("No pages found")}</Combobox.Empty>
                                    )}

                                    {pageItems.map((item) => (
                                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                            <Combobox.Option value={item.id} style={{ flex: 1 }}>
                                                <Group gap="xs">
                                                    {item.hasChildren ? <IconFolder size={16} /> : <IconFile size={16} />}
                                                    <Text size="sm" truncate>{item.title}</Text>
                                                </Group>
                                            </Combobox.Option>

                                            {!debouncedSearchValue && item.hasChildren && (
                                                <ActionIcon
                                                    variant="subtle"
                                                    size="sm"
                                                    mr="xs"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleNavigateDown(item);
                                                    }}
                                                    title={t("Open folder")}
                                                >
                                                    <IconChevronRight size={16} />
                                                </ActionIcon>
                                            )}
                                        </div>
                                    ))}
                                </ScrollArea.Autosize>
                            </Combobox.Options>
                        </Combobox.Dropdown>
                    </Combobox>

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

                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={() => navigate("/home", { replace: true })}>
                            {t("Cancel")}
                        </Button>
                        <Button
                            onClick={handleImport}
                            loading={isImporting}
                            disabled={!selectedSpace || isImporting}
                        >
                            {t("Save Page")}
                        </Button>
                    </Group>
                </Stack>
            </Paper>
        </Container>
    );
}
