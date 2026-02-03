import { Checkbox, Box } from "@mantine/core";
import classes from "./data-table.module.css";

interface CheckboxCellProps {
    value: boolean;
    onChange: (value: boolean) => void;
    isEditable: boolean;
}

export function CheckboxCell({ value, onChange, isEditable }: CheckboxCellProps) {
    return (
        <Box
            className={classes.cellInput}
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}
            onClick={() => isEditable && onChange(!value)}
        >
            <Checkbox
                checked={!!value}
                readOnly={!isEditable}
                onChange={() => { }} // Handle change in parent box click for better area
                style={{ cursor: isEditable ? "pointer" : "default" }}
                tabIndex={-1}
            />
        </Box>
    );
}
