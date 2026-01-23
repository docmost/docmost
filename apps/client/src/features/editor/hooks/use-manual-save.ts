import { useAtom } from "jotai";
import { useCallback } from "react";
import { pageEditorAtom, hasUnsavedChangesAtom } from "@/features/editor/atoms/editor-atoms";
import { useUpdatePageMutation } from "@/features/page/queries/page-query";
import { notifications } from "@mantine/notifications";

export function useManualSave(pageId: string) {
    const [pageEditor] = useAtom(pageEditorAtom);
    const [, setHasUnsavedChanges] = useAtom(hasUnsavedChangesAtom);
    const updatePageMutation = useUpdatePageMutation();

    const handleManualSave = useCallback(async () => {
        if (!pageEditor) {
            return;
        }

        try {
            const content = pageEditor.getJSON();

            await updatePageMutation.mutateAsync({
                pageId,
                content,
                forceHistorySave: true,
            });

            setHasUnsavedChanges(false);
            notifications.show({
                message: "Page saved successfully",
                color: "green",
            });
        } catch (error) {
            notifications.show({
                message: "Failed to save page",
                color: "red",
            });
        }
    }, [pageEditor, pageId, updatePageMutation, setHasUnsavedChanges]);

    return { handleManualSave, isSaving: updatePageMutation.isPending };
}
