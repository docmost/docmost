import React, { useState, useMemo, useEffect } from 'react';
import { Group, Text, UnstyledButton, Popover, TextInput, ScrollArea, Checkbox } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query.ts";
import { useDebouncedValue } from "@mantine/hooks";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import classes from "./data-table.module.css";
import { IUser } from "@/features/user/types/user.types.ts";

interface PersonCellProps {
    value: string; // Comma-separated user IDs
    onChange: (value: string) => void;
    isEditable: boolean;
}

export function PersonCell({ value, onChange, isEditable }: PersonCellProps) {
    const [opened, setOpened] = useState(false);
    const selectedIds = useMemo(() => value ? value.split(',') : [], [value]);
    const [searchValue, setSearchValue] = useState("");
    const [debouncedSearch] = useDebouncedValue(searchValue, 300);

    const { data: membersData } = useWorkspaceMembersQuery({
        query: debouncedSearch,
        limit: 50
    });

    const [loadedMembers, setLoadedMembers] = useState<IUser[]>([]);

    useEffect(() => {
        if (membersData?.items) {
            setLoadedMembers(prev => {
                const newMembers = membersData.items.filter(m => !prev.find(p => p.id === m.id));
                return [...prev, ...newMembers];
            });
        }
    }, [membersData]);

    const displayMembers = useMemo(() => {
        return loadedMembers.filter(m => selectedIds.includes(m.id));
    }, [loadedMembers, selectedIds]);

    const toggleMember = (id: string) => {
        const newIds = selectedIds.includes(id)
            ? selectedIds.filter(i => i !== id)
            : [...selectedIds, id];
        onChange(newIds.join(','));
    };

    return (
        <Popover
            opened={opened}
            onChange={setOpened}
            position="bottom-start"
            offset={0}
            disabled={!isEditable}
            width={300}
            withArrow={false}
            shadow="md"
            withinPortal
        >
            <Popover.Target>
                <UnstyledButton
                    className={classes.personCellTarget}
                    onClick={() => setOpened(o => !o)}
                    style={{
                        width: '100%',
                        minHeight: '100%',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'flex-start'
                    }}
                >
                    <Group gap={6} wrap="wrap">
                        {displayMembers.length === 0 ? (
                            <Text size="sm" c="dimmed">{isEditable ? "Empty" : ""}</Text>
                        ) : (
                            displayMembers.map(m => (
                                <Group key={m.id} gap={4} className={classes.personBadge}>
                                    <CustomAvatar name={m.name} avatarUrl={m.avatarUrl} size={18} />
                                    <Text size="xs" style={{ whiteSpace: 'nowrap' }}>{m.name}</Text>
                                </Group>
                            ))
                        )}
                    </Group>
                </UnstyledButton>
            </Popover.Target>
            <Popover.Dropdown p="xs">
                <TextInput
                    placeholder="Search for people..."
                    leftSection={<IconSearch size={14} />}
                    size="xs"
                    mb="xs"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.currentTarget.value)}
                    autoFocus
                />
                <Text size="xs" c="dimmed" mb={5} px={4}>Select as many as you like</Text>
                <ScrollArea.Autosize mah={250} mt="xs">
                    {(membersData?.items || []).map(member => (
                        <UnstyledButton
                            key={member.id}
                            onClick={() => toggleMember(member.id)}
                            className={classes.personSelectItem}
                        >
                            <Group gap="sm" wrap="nowrap">
                                <Checkbox
                                    size="xs"
                                    checked={selectedIds.includes(member.id)}
                                    readOnly
                                    tabIndex={-1}
                                />
                                <CustomAvatar name={member.name} avatarUrl={member.avatarUrl} size={24} />
                                <Text size="sm">{member.name}</Text>
                            </Group>
                        </UnstyledButton>
                    ))}
                    {searchValue && membersData?.items && membersData.items.length === 0 && (
                        <Text size="xs" c="dimmed" ta="center" py="sm">No members found</Text>
                    )}
                </ScrollArea.Autosize>
            </Popover.Dropdown>
        </Popover>
    );
}
