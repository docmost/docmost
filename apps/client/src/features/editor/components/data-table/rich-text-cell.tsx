import { Box, Textarea, Modal, Button, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconMarkdown } from "@tabler/icons-react";
import classes from "./data-table.module.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RichTextCellProps {
    value: string;
    onChange: (value: string) => void;
    isEditable: boolean;
}

export function RichTextCell({ value, onChange, isEditable }: RichTextCellProps) {
    const [opened, { open, close }] = useDisclosure(false);

    const handleClick = () => {
        if (isEditable) {
            open();
        }
    };

    return (
        <>
            <Box
                className={classes.cellInput}
                style={{
                    width: "100%",
                    minHeight: "100%",
                    padding: "var(--mantine-spacing-xs)",
                    cursor: isEditable ? "pointer" : "default",
                    fontSize: "14px"
                }}
                onClick={handleClick}
            >
                {value ? (
                    <div className="markdown-cell-preview" style={{ maxHeight: '100px', overflow: 'hidden' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {value}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <span style={{ color: "var(--mantine-color-dimmed)", fontStyle: "italic" }}>Empty</span>
                )}
            </Box>

            <Modal opened={opened} onClose={close} title="Edit Rich Text" size="lg">
                <Textarea
                    value={value}
                    onChange={(e) => onChange(e.currentTarget.value)}
                    autosize
                    minRows={5}
                    maxRows={20}
                    placeholder="Type markdown here..."
                />
                <Group justify="flex-end" mt="md">
                    <Button onClick={close}>Close</Button>
                </Group>
            </Modal>
        </>
    );
}
