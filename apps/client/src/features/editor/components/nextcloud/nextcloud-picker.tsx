import {
  ActionIcon,
  Box,
  Breadcrumbs,
  Button,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure, useLocalStorage } from "@mantine/hooks";
import { useState, useCallback, useEffect } from "react";
import {
  IconFolder,
  IconFile,
  IconFileTypePdf,
  IconMovie,
  IconMusic,
  IconPhoto,
  IconChevronRight,
  IconCloud,
  IconArrowLeft,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Editor } from "@tiptap/react";

interface NextcloudFile {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  mimeType: string;
  lastModified: string;
}

interface NextcloudCredentials {
  ncUrl: string;
  ncUser: string;
  ncPassword: string;
}

interface Props {
  editor: Editor;
}

function getFileIcon(mimeType: string, size = 20) {
  if (mimeType === "httpd/unix-directory") return <IconFolder size={size} color="#fab005" />;
  if (mimeType === "application/pdf") return <IconFileTypePdf size={size} color="#e03131" />;
  if (mimeType.startsWith("video/")) return <IconMovie size={size} color="#1971c2" />;
  if (mimeType.startsWith("audio/")) return <IconMusic size={size} color="#2f9e44" />;
  if (mimeType.startsWith("image/")) return <IconPhoto size={size} color="#ae3ec9" />;
  return <IconFile size={size} color="#868e96" />;
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EMBEDDABLE_TYPES = [
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/flac",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
  "image/webp",
];

function isEmbeddable(mimeType: string): boolean {
  return EMBEDDABLE_TYPES.includes(mimeType) ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("image/");
}

export function NextcloudPicker({ editor }: Props) {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const [loginStep, setLoginStep] = useState(false);

  const [credentials, setCredentials] = useLocalStorage<NextcloudCredentials>({
    key: "docmost-nextcloud-credentials",
    defaultValue: { ncUrl: "", ncUser: "", ncPassword: "" },
  });

  const [formCreds, setFormCreds] = useState<NextcloudCredentials>(credentials);
  const [currentPath, setCurrentPath] = useState("/");
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [files, setFiles] = useState<NextcloudFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inserting, setInserting] = useState<string | null>(null);

  const isLoggedIn = !!(credentials.ncUrl && credentials.ncUser && credentials.ncPassword);

  const loadFiles = useCallback(async (path: string, creds: NextcloudCredentials) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        path,
        ncUrl: creds.ncUrl,
        ncUser: creds.ncUser,
        ncPassword: creds.ncPassword,
      });
      const res = await fetch(`/api/nextcloud/list?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      const data = await res.json();
      setFiles(data);
    } catch (e: any) {
      setError(e.message || "Failed to load files");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (opened && isLoggedIn) {
      loadFiles(currentPath, credentials);
    }
  }, [opened, isLoggedIn, currentPath, credentials, loadFiles]);

  const handleOpen = () => {
    setCurrentPath("/");
    setPathHistory([]);
    if (!isLoggedIn) {
      setLoginStep(true);
    } else {
      setLoginStep(false);
    }
    open();
  };

  const handleLogin = () => {
    const trimmed = {
      ncUrl: formCreds.ncUrl.replace(/\/$/, ""),
      ncUser: formCreds.ncUser.trim(),
      ncPassword: formCreds.ncPassword,
    };
    setCredentials(trimmed);
    setLoginStep(false);
    loadFiles("/", trimmed);
  };

  const handleLogout = () => {
    setCredentials({ ncUrl: "", ncUser: "", ncPassword: "" });
    setLoginStep(true);
    setFiles([]);
  };

  const navigateTo = (path: string) => {
    setPathHistory((h) => [...h, currentPath]);
    setCurrentPath(path);
  };

  const navigateBack = () => {
    const prev = pathHistory[pathHistory.length - 1] || "/";
    setPathHistory((h) => h.slice(0, -1));
    setCurrentPath(prev);
  };

  const getBreadcrumbs = () => {
    const parts = currentPath.split("/").filter(Boolean);
    const crumbs = [{ label: "Home", path: "/" }];
    parts.forEach((part, i) => {
      crumbs.push({
        label: part,
        path: "/" + parts.slice(0, i + 1).join("/"),
      });
    });
    return crumbs;
  };

  const handleInsert = async (file: NextcloudFile) => {
    if (!isEmbeddable(file.mimeType)) return;
    setInserting(file.path);
    try {
      const res = await fetch("/api/nextcloud/share", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ncUrl: credentials.ncUrl,
          ncUser: credentials.ncUser,
          ncPassword: credentials.ncPassword,
          filePath: file.path,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      const { embedUrl } = await res.json();

      // Insert as embed block in Docmost editor
      editor
        .chain()
        .focus()
        .setIframe({ src: embedUrl })
        .run();

      close();
    } catch (e: any) {
      setError(e.message || "Failed to create share");
    } finally {
      setInserting(null);
    }
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <>
      <Tooltip label="Nextcloud" position="top" withinPortal={false}>
        <ActionIcon onClick={handleOpen} variant="subtle" size="lg">
          <IconCloud size={18} />
        </ActionIcon>
      </Tooltip>

      <Modal
        opened={opened}
        onClose={close}
        title={
          <Group gap="xs">
            <IconCloud size={18} />
            <Text fw={600}>Nextcloud</Text>
            {isLoggedIn && !loginStep && (
              <Text size="xs" c="dimmed">
                {credentials.ncUser}@{new URL(credentials.ncUrl).hostname}
              </Text>
            )}
          </Group>
        }
        size="lg"
        centered
      >
        {loginStep ? (
          /* ── Login form ── */
          <Stack gap="sm">
            <TextInput
              label="Nextcloud URL"
              placeholder="https://cloud.example.com"
              value={formCreds.ncUrl}
              onChange={(e) => setFormCreds((f) => ({ ...f, ncUrl: e.target.value }))}
            />
            <TextInput
              label={t("Username")}
              value={formCreds.ncUser}
              onChange={(e) => setFormCreds((f) => ({ ...f, ncUser: e.target.value }))}
            />
            <PasswordInput
              label={t("Password")}
              description="Use an app password (Settings → Security → App passwords)"
              value={formCreds.ncPassword}
              onChange={(e) => setFormCreds((f) => ({ ...f, ncPassword: e.target.value }))}
            />
            <Button
              onClick={handleLogin}
              disabled={!formCreds.ncUrl || !formCreds.ncUser || !formCreds.ncPassword}
              mt="xs"
            >
              {t("Connect")}
            </Button>
          </Stack>
        ) : (
          /* ── File browser ── */
          <Stack gap="xs">
            {/* Toolbar */}
            <Group justify="space-between">
              <Group gap={4}>
                <ActionIcon
                  variant="subtle"
                  disabled={pathHistory.length === 0}
                  onClick={navigateBack}
                  title="Back"
                >
                  <IconArrowLeft size={16} />
                </ActionIcon>
                <Breadcrumbs
                  separator={<IconChevronRight size={12} />}
                  style={{ flexWrap: "wrap" }}
                >
                  {breadcrumbs.map((crumb) => (
                    <UnstyledButton
                      key={crumb.path}
                      onClick={() => {
                        setPathHistory((h) => [...h, currentPath]);
                        setCurrentPath(crumb.path);
                      }}
                      style={{ fontSize: 13 }}
                    >
                      {crumb.label}
                    </UnstyledButton>
                  ))}
                </Breadcrumbs>
              </Group>
              <Button variant="subtle" size="compact-xs" color="red" onClick={handleLogout}>
                {t("Disconnect")}
              </Button>
            </Group>

            {/* Error */}
            {error && (
              <Text size="sm" c="red">
                {error}
              </Text>
            )}

            {/* File list */}
            <Box
              style={{
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: 8,
                minHeight: 300,
                maxHeight: 420,
                overflowY: "auto",
              }}
            >
              {loading ? (
                <Group justify="center" p="xl">
                  <Loader size="sm" />
                </Group>
              ) : files.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" p="xl">
                  {t("Empty folder")}
                </Text>
              ) : (
                files.map((file) => {
                  const embeddable = file.type === "file" && isEmbeddable(file.mimeType);
                  return (
                    <Group
                      key={file.path}
                      px="sm"
                      py={6}
                      justify="space-between"
                      style={{
                        cursor: file.type === "directory" ? "pointer" : embeddable ? "pointer" : "default",
                        borderRadius: 6,
                        opacity: file.type === "file" && !embeddable ? 0.45 : 1,
                      }}
                      className="nextcloud-file-row"
                      onClick={() => {
                        if (file.type === "directory") {
                          navigateTo(file.path);
                        }
                      }}
                    >
                      <Group gap="xs">
                        {getFileIcon(file.mimeType)}
                        <div>
                          <Text size="sm" lineClamp={1}>
                            {file.name}
                          </Text>
                          {file.type === "file" && (
                            <Text size="xs" c="dimmed">
                              {formatSize(file.size)}
                              {!embeddable && " — not embeddable"}
                            </Text>
                          )}
                        </div>
                      </Group>

                      {embeddable && (
                        <Button
                          size="compact-xs"
                          variant="light"
                          loading={inserting === file.path}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInsert(file);
                          }}
                        >
                          {t("Insert")}
                        </Button>
                      )}
                    </Group>
                  );
                })
              )}
            </Box>

            <Text size="xs" c="dimmed">
              Supported: PDF, video, audio, images
            </Text>
          </Stack>
        )}
      </Modal>
    </>
  );
}
