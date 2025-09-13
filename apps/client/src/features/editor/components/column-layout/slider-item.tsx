import { Slider, Text } from "@mantine/core";

interface SliderItemProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export const SliderItem: React.FC<SliderItemProps> = ({
  label,
  value,
  onChange,
}) => {
  return (
    <>
      <Text size="xs">{label}</Text>
      <Slider
        color="blue"
        min={0}
        max={12}
        step={1}
        h={35}
        value={value}
        onChange={onChange}
        label={(value) => (value === 0 ? "auto" : value)}
        marks={[
          { value: 0, label: "auto" },
          { value: 6, label: "6" },
          { value: 12, label: "12" },
        ]}
      />
    </>
  );
};
