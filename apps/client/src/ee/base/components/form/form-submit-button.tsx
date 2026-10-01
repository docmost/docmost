import { Button, useComputedColorScheme } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import classes from "@/ee/base/styles/form.module.css";

type FormSubmitButtonProps = {
  label: string;
  type?: "button" | "submit";
  loading?: boolean;
  disabled?: boolean;
};

export function FormSubmitButton({
  label,
  type = "button",
  loading,
  disabled,
}: FormSubmitButtonProps) {
  const colorScheme = useComputedColorScheme("light");

  return (
    <Button
      type={type}
      size="sm"
      radius="md"
      color={colorScheme === "dark" ? "gray.0" : "dark.7"}
      autoContrast
      className={classes.submit}
      rightSection={<IconArrowRight size={16} className={classes.submitArrow} />}
      loading={loading}
      disabled={disabled}
    >
      {label}
    </Button>
  );
}
