import {
  ColorInput,
  Group,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconColorPicker } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_DOCS_PRESET,
  DOCS_THEME_PRESETS,
  isValidDocsColor,
  matchDocsPreset,
} from "@/features/public-space/theme/docs-theme.ts";
import { IPublicSpaceAppearance } from "@/features/public-space/types/public-space.types.ts";
import { usePublishSpaceMutation } from "@/features/public-space/queries/public-space-query.ts";
import { useHasFeature } from "@/ee/hooks/use-feature.ts";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label.ts";
import { Feature } from "@/ee/features.ts";
import classes from "./appearance-settings.module.css";

type AppearanceSettingsProps = {
  spaceId: string;
  appearance?: IPublicSpaceAppearance;
};

export default function AppearanceSettings({
  spaceId,
  appearance,
}: AppearanceSettingsProps) {
  const { t } = useTranslation();
  const publishMutation = usePublishSpaceMutation();
  const hasAppearance = useHasFeature(Feature.PUBLIC_SPACE_APPEARANCE);
  const upgradeLabel = useUpgradeLabel();

  const matchedPreset = matchDocsPreset(appearance);
  const [customOpen, setCustomOpen] = useState(matchedPreset === null);
  const [customLight, setCustomLight] = useState(
    appearance?.primaryColorLight ?? DEFAULT_DOCS_PRESET.light,
  );
  const [customDark, setCustomDark] = useState(
    appearance?.primaryColorDark ?? DEFAULT_DOCS_PRESET.dark,
  );

  useEffect(() => {
    setCustomOpen(matchDocsPreset(appearance) === null);
    setCustomLight(appearance?.primaryColorLight ?? DEFAULT_DOCS_PRESET.light);
    setCustomDark(appearance?.primaryColorDark ?? DEFAULT_DOCS_PRESET.dark);
  }, [appearance?.primaryColorLight, appearance?.primaryColorDark]);

  const saveAppearance = (payload: {
    primaryColorLight: string | null;
    primaryColorDark: string | null;
  }) => {
    if (!hasAppearance) return;
    publishMutation.mutate({ spaceId, enabled: true, appearance: payload });
  };

  const selectPreset = (presetId: string) => {
    setCustomOpen(false);
    const preset = DOCS_THEME_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    if (preset.id === DEFAULT_DOCS_PRESET.id) {
      saveAppearance({ primaryColorLight: null, primaryColorDark: null });
      return;
    }
    saveAppearance({
      primaryColorLight: preset.light,
      primaryColorDark: preset.dark,
    });
  };

  const commitCustom = (light: string, dark: string) => {
    if (!isValidDocsColor(light) || !isValidDocsColor(dark)) return;
    saveAppearance({ primaryColorLight: light, primaryColorDark: dark });
  };

  const swatches = DOCS_THEME_PRESETS.flatMap((preset) => [
    preset.light,
    preset.dark,
  ]);

  return (
    <div>
      <Text size="md" mt="md">
        {t("Appearance")}
      </Text>
      <Text size="sm" c="dimmed">
        {t("Choose the primary color of the public docs site.")}
      </Text>

      <Tooltip
        label={upgradeLabel}
        disabled={hasAppearance}
        position="top-start"
      >
        <div className={classes.presetRow} style={{ marginTop: 10 }}>
          {DOCS_THEME_PRESETS.map((preset) => {
            const selected = !customOpen && matchedPreset?.id === preset.id;
            return (
              <UnstyledButton
                key={preset.id}
                className={classes.presetCard}
                data-selected={selected || undefined}
                aria-pressed={selected}
                disabled={!hasAppearance}
                onClick={() => selectPreset(preset.id)}
              >
                <span
                  className={classes.presetSwatch}
                  style={{
                    background: `linear-gradient(135deg, ${preset.light} 50%, ${preset.dark} 50%)`,
                  }}
                />
                <Text size="xs">{t(preset.nameKey)}</Text>
              </UnstyledButton>
            );
          })}

          <UnstyledButton
            className={classes.presetCard}
            data-selected={customOpen || undefined}
            aria-pressed={customOpen}
            disabled={!hasAppearance}
            onClick={() => setCustomOpen(true)}
          >
            <span className={classes.customSwatch}>
              <IconColorPicker size={13} stroke={2} aria-hidden />
            </span>
            <Text size="xs">{t("Custom")}</Text>
          </UnstyledButton>
        </div>
      </Tooltip>

      {customOpen && hasAppearance && (
        <Group grow mt="sm" align="flex-start">
          <ColorInput
            label={t("Light mode color")}
            format="hex"
            value={customLight}
            swatches={swatches}
            onChange={setCustomLight}
            onChangeEnd={(value) => {
              setCustomLight(value);
              commitCustom(value, customDark);
            }}
          />
          <ColorInput
            label={t("Dark mode color")}
            format="hex"
            value={customDark}
            swatches={swatches}
            onChange={setCustomDark}
            onChangeEnd={(value) => {
              setCustomDark(value);
              commitCustom(customLight, value);
            }}
          />
        </Group>
      )}
    </div>
  );
}
