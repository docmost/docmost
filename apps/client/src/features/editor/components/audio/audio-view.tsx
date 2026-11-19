import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  ActionIcon,
  Loader,
  Menu,
  Slider,
  Text,
  UnstyledButton,
  useComputedColorScheme,
} from "@mantine/core";
import {
  IconCheck,
  IconDownload,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFileUrl } from "@/lib/config.ts";
import { formatBytes } from "@/lib";
import { getAudioFileName, isInternalFileUrl } from "@docmost/editor-ext";
import { RadioMenuItem } from "@/components/ui/radio-menu-item";
import classes from "./audio-view.module.css";
import { useTranslation } from "react-i18next";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

// a long name is cut in the middle so its extension stays visible
function splitExtension(fileName: string): [string, string] {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || fileName.length - dot > 6) return [fileName, ""];
  return [fileName.slice(0, dot), fileName.slice(dot)];
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export default function AudioView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node } = props;
  const { src, name, size, placeholder } = node.attrs;
  const colorScheme = useComputedColorScheme("light");
  const audioRef = useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekValue, setSeekValue] = useState<number | null>(null);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const safeSrc = useMemo(() => {
    if (!src || !isInternalFileUrl(src)) return null;
    return getFileUrl(src);
  }, [src]);

  const isUploading = !safeSrc && !!placeholder;
  const fileName = isUploading
    ? placeholder?.name || null
    : getAudioFileName({ name, src });
  const [stem, extension] = splitExtension(fileName ?? "");
  const sizeLabel = size && !isUploading ? formatBytes(Number(size)) : null;
  const hasDuration = Number.isFinite(duration) && duration > 0;
  const canPlay = !!safeSrc && !loadError;

  // read the element, it resets itself on a new file and survives a hot reload
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaying(!audio.paused);
    setCurrentTime(audio.currentTime);
    setDuration(audio.duration);
    setMuted(audio.muted);
    setSeekValue(null);
    setLoadError(!!audio.error);
  }, [safeSrc]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !canPlay) return;
    if (audio.paused) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [canPlay]);

  const handleSeekEnd = useCallback((value: number) => {
    if (audioRef.current) audioRef.current.currentTime = value;
    setCurrentTime(value);
    setSeekValue(null);
  }, []);

  const changeRate = useCallback((value: number) => {
    if (audioRef.current) audioRef.current.playbackRate = value;
    setRate(value);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  }, []);

  return (
    <NodeViewWrapper data-drag-handle>
      <div
        className={classes.audioCard}
        role="group"
        aria-label={fileName || t("Audio")}
      >
        <audio
          ref={audioRef}
          src={safeSrc ?? undefined}
          preload="metadata"
          hidden
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            e.currentTarget.playbackRate = rate;
          }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setLoadError(true)}
        />

        <ActionIcon
          data-audio-controls
          size={44}
          radius="xl"
          variant="filled"
          onClick={togglePlay}
          disabled={!canPlay}
          aria-label={playing ? t("Pause") : t("Play")}
        >
          {isUploading ? (
            <Loader size={18} />
          ) : playing ? (
            <IconPlayerPauseFilled size={20} />
          ) : (
            <IconPlayerPlayFilled size={20} className={classes.playIcon} />
          )}
        </ActionIcon>

        <div className={classes.body}>
          <div className={classes.titleRow}>
            {isUploading ? (
              <Text component="span" size="sm" c="dimmed" truncate="end">
                {fileName
                  ? t("Uploading {{name}}", { name: fileName })
                  : t("Uploading file")}
              </Text>
            ) : (
              <Text
                component="span"
                size="sm"
                fw={600}
                className={classes.name}
                title={fileName ?? undefined}
              >
                <span className={classes.stem}>{stem || t("Audio")}</span>
                <span className={classes.extension}>{extension}</span>
              </Text>
            )}
            {sizeLabel && (
              <Text component="span" size="xs" c="dimmed" className={classes.meta}>
                {sizeLabel}
              </Text>
            )}
          </div>

          {loadError ? (
            <Text size="xs" c="red">
              {t("Couldn't load this audio file")}
            </Text>
          ) : (
            <div className={classes.seekRow} data-audio-controls>
              <Text component="span" size="xs" c="dimmed" className={classes.time}>
                {formatTime(seekValue ?? currentTime)}
              </Text>
              <Slider
                className={classes.seek}
                size="xs"
                thumbSize={12}
                min={0}
                max={hasDuration ? duration : 1}
                step={0.1}
                value={hasDuration ? (seekValue ?? currentTime) : 0}
                onChange={setSeekValue}
                onChangeEnd={handleSeekEnd}
                label={formatTime}
                disabled={!canPlay || !hasDuration}
                thumbLabel={t("Seek")}
                color={colorScheme === "dark" ? "blue.4" : "blue.6"}
              />
              <Text component="span" size="xs" c="dimmed" className={classes.time}>
                {hasDuration ? formatTime(duration) : "--:--"}
              </Text>
            </div>
          )}
        </div>

        <div className={classes.actions} data-audio-controls>
          <Menu position="bottom-end" shadow="md" disabled={!canPlay}>
            <Menu.Target>
              <UnstyledButton
                className={classes.speedButton}
                disabled={!canPlay}
                aria-label={t("Playback speed")}
              >
                {rate}×
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              {PLAYBACK_RATES.map((value) => (
                <Menu.Item
                  key={value}
                  component={RadioMenuItem}
                  aria-checked={value === rate}
                  onClick={() => changeRate(value)}
                  rightSection={
                    value === rate ? <IconCheck size={14} aria-hidden /> : null
                  }
                >
                  {value}×
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>

          <ActionIcon
            className={classes.volume}
            variant="subtle"
            color="gray"
            size={36}
            onClick={toggleMute}
            disabled={!canPlay}
            aria-label={muted ? t("Unmute") : t("Mute")}
          >
            {muted ? <IconVolumeOff size={18} /> : <IconVolume size={18} />}
          </ActionIcon>

          {safeSrc && (
            <ActionIcon
              component="a"
              href={safeSrc}
              download
              className={classes.download}
              variant="subtle"
              color="gray"
              size={36}
              aria-label={t("Download")}
            >
              <IconDownload size={18} />
            </ActionIcon>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
