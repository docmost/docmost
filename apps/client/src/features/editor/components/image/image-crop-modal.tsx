import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  NumberInput,
  Box,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { getFileUrl } from '@/lib/config.ts';
import { pageService } from '@/features/page/services/page-service.ts';

interface ImageCropModalProps {
  opened: boolean;
  onClose: () => void;
  attachmentId: string;
  src: string;
  onCropApplied?: () => void;
}

export default function ImageCropModal({
  opened,
  onClose,
  attachmentId,
  src,
  onCropApplied,
}: ImageCropModalProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [cropData, setCropData] = useState({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    const img = imageRef.current;
    if (img) {
      // Initialize crop to center of image
      const centerX = Math.max(0, img.naturalWidth / 2 - 50);
      const centerY = Math.max(0, img.naturalHeight / 2 - 50);
      setCropData({
        x: centerX,
        y: centerY,
        width: Math.min(100, img.naturalWidth),
        height: Math.min(100, img.naturalHeight),
      });
    }
  }, []);

  const drawCropOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match image display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scale factor
    const scaleX = canvas.width / img.naturalWidth;
    const scaleY = canvas.height / img.naturalHeight;

    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear crop area
    ctx.clearRect(
      cropData.x * scaleX,
      cropData.y * scaleY,
      cropData.width * scaleX,
      cropData.height * scaleY,
    );

    // Draw crop rectangle
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      cropData.x * scaleX,
      cropData.y * scaleY,
      cropData.width * scaleX,
      cropData.height * scaleY,
    );
  }, [cropData, imageLoaded]);

  useEffect(() => {
    drawCropOverlay();
  }, [drawCropOverlay]);

  const handleApplyCrop = async () => {
    if (!imageRef.current) return;

    setIsLoading(true);
    try {
      await pageService.updateCropMetadata(attachmentId, cropData);
      notifications.show({
        message: t('Image cropped successfully'),
        color: 'green',
      });
      onCropApplied?.();
      onClose();
    } catch (error) {
      notifications.show({
        message: t('Failed to crop image'),
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSliderChange = (field: keyof typeof cropData, value: number) => {
    setCropData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Crop Image')}
      size="lg"
      centered
    >
      <Stack>
        <Box pos="relative" style={{ width: '100%', height: '400px' }}>
          <img
            ref={imageRef}
            src={getFileUrl(src)}
            alt="Crop preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
            onLoad={handleImageLoad}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
        </Box>

        {imageLoaded && (
          <Stack gap="md">
            <Group grow>
              <NumberInput
                label={t('X Position')}
                value={cropData.x}
                onChange={(value) => handleSliderChange('x', Number(value))}
                min={0}
                max={imageRef.current?.naturalWidth || 100}
              />
              <NumberInput
                label={t('Y Position')}
                value={cropData.y}
                onChange={(value) => handleSliderChange('y', Number(value))}
                min={0}
                max={imageRef.current?.naturalHeight || 100}
              />
            </Group>

            <Group grow>
              <NumberInput
                label={t('Width')}
                value={cropData.width}
                onChange={(value) => handleSliderChange('width', Number(value))}
                min={1}
                max={imageRef.current?.naturalWidth || 100}
              />
              <NumberInput
                label={t('Height')}
                value={cropData.height}
                onChange={(value) => handleSliderChange('height', Number(value))}
                min={1}
                max={imageRef.current?.naturalHeight || 100}
              />
            </Group>
          </Stack>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleApplyCrop} loading={isLoading}>
            {t('Apply Crop')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}