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

type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move' | null;

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

  // Mouse interaction state
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [activeHandle, setActiveHandle] = useState<HandleType>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0, cropW: 0, cropH: 0 });

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    const img = imageRef.current;
    if (img) {
      // Default crop to full image size
      setCropData({
        x: 0,
        y: 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    }
  }, []);

  const getScaleFactors = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return { scaleX: 1, scaleY: 1 };

    const rect = canvas.getBoundingClientRect();
    return {
      scaleX: rect.width / img.naturalWidth,
      scaleY: rect.height / img.naturalHeight,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
    };
  }, []);

  const drawCropOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { scaleX, scaleY, canvasWidth, canvasHeight } = getScaleFactors();
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const x = cropData.x * scaleX;
    const y = cropData.y * scaleY;
    const w = cropData.width * scaleX;
    const h = cropData.height * scaleY;

    // Clear crop area
    ctx.clearRect(x, y, w, h);

    // Draw crop rectangle border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Draw handles
    const handleSize = 8;
    ctx.fillStyle = '#fff';
    
    const handles = [
      { x: x, y: y }, // nw
      { x: x + w / 2, y: y }, // n
      { x: x + w, y: y }, // ne
      { x: x + w, y: y + h / 2 }, // e
      { x: x + w, y: y + h }, // se
      { x: x + w / 2, y: y + h }, // s
      { x: x, y: y + h }, // sw
      { x: x, y: y + h / 2 }, // w
    ];

    handles.forEach(hPos => {
      ctx.beginPath();
      ctx.arc(hPos.x, hPos.y, handleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }, [cropData, imageLoaded, getScaleFactors]);

  useEffect(() => {
    drawCropOverlay();
  }, [drawCropOverlay]);

  const getHandleAtPosition = (mouseX: number, mouseY: number): HandleType => {
    const { scaleX, scaleY } = getScaleFactors();
    const x = cropData.x * scaleX;
    const y = cropData.y * scaleY;
    const w = cropData.width * scaleX;
    const h = cropData.height * scaleY;
    const threshold = 10;

    if (Math.abs(mouseX - x) < threshold && Math.abs(mouseY - y) < threshold) return 'nw';
    if (Math.abs(mouseX - (x + w)) < threshold && Math.abs(mouseY - y) < threshold) return 'ne';
    if (Math.abs(mouseX - (x + w)) < threshold && Math.abs(mouseY - (y + h)) < threshold) return 'se';
    if (Math.abs(mouseX - x) < threshold && Math.abs(mouseY - (y + h)) < threshold) return 'sw';
    if (Math.abs(mouseX - (x + w / 2)) < threshold && Math.abs(mouseY - y) < threshold) return 'n';
    if (Math.abs(mouseX - (x + w)) < threshold && Math.abs(mouseY - (y + h / 2)) < threshold) return 'e';
    if (Math.abs(mouseX - (x + w / 2)) < threshold && Math.abs(mouseY - (y + h)) < threshold) return 's';
    if (Math.abs(mouseX - x) < threshold && Math.abs(mouseY - (y + h / 2)) < threshold) return 'w';
    
    if (mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h) return 'move';
    
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const handle = getHandleAtPosition(mouseX, mouseY);
    if (handle) {
      setIsMouseDown(true);
      setActiveHandle(handle);
      setDragStart({
        x: mouseX,
        y: mouseY,
        cropX: cropData.x,
        cropY: cropData.y,
        cropW: cropData.width,
        cropH: cropData.height,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (!isMouseDown) {
      const handle = getHandleAtPosition(mouseX, mouseY);
      canvas.style.cursor = handle === 'move' ? 'move' : (handle ? 'pointer' : 'default');
      return;
    }

    const { scaleX, scaleY } = getScaleFactors();
    const dx = (mouseX - dragStart.x) / scaleX;
    const dy = (mouseY - dragStart.y) / scaleY;

    let newCrop = { ...cropData };

    if (activeHandle === 'move') {
      newCrop.x = Math.max(0, Math.min(img.naturalWidth - dragStart.cropW, dragStart.cropX + dx));
      newCrop.y = Math.max(0, Math.min(img.naturalHeight - dragStart.cropH, dragStart.cropY + dy));
    } else if (activeHandle) {
      if (activeHandle.includes('w')) {
        const newX = Math.max(0, Math.min(dragStart.cropX + dragStart.cropW - 10, dragStart.cropX + dx));
        newCrop.width = dragStart.cropW + (dragStart.cropX - newX);
        newCrop.x = newX;
      }
      if (activeHandle.includes('e')) {
        newCrop.width = Math.max(10, Math.min(img.naturalWidth - dragStart.cropX, dragStart.cropW + dx));
      }
      if (activeHandle.includes('n')) {
        const newY = Math.max(0, Math.min(dragStart.cropY + dragStart.cropH - 10, dragStart.cropY + dy));
        newCrop.height = dragStart.cropH + (dragStart.cropY - newY);
        newCrop.y = newY;
      }
      if (activeHandle.includes('s')) {
        newCrop.height = Math.max(10, Math.min(img.naturalHeight - dragStart.cropY, dragStart.cropH + dy));
      }
    }

    setCropData(newCrop);
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    setActiveHandle(null);
  };

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

  const handleInputChange = (field: keyof typeof cropData, value: number) => {
    const img = imageRef.current;
    if (!img) return;

    let val = Number(value);
    if (field === 'x') val = Math.max(0, Math.min(img.naturalWidth - cropData.width, val));
    if (field === 'y') val = Math.max(0, Math.min(img.naturalHeight - cropData.height, val));
    if (field === 'width') val = Math.max(10, Math.min(img.naturalWidth - cropData.x, val));
    if (field === 'height') val = Math.max(10, Math.min(img.naturalHeight - cropData.y, val));

    setCropData(prev => ({ ...prev, [field]: val }));
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
        <Box pos="relative" style={{ width: '100%', height: '400px', userSelect: 'none' }}>
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
              touchAction: 'none',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </Box>

        {imageLoaded && (
          <Stack gap="md">
            <Group grow>
              <NumberInput
                label={t('X Position')}
                value={Math.round(cropData.x)}
                onChange={(value) => handleInputChange('x', Number(value))}
                min={0}
                max={imageRef.current?.naturalWidth || 100}
              />
              <NumberInput
                label={t('Y Position')}
                value={Math.round(cropData.y)}
                onChange={(value) => handleInputChange('y', Number(value))}
                min={0}
                max={imageRef.current?.naturalHeight || 100}
              />
            </Group>

            <Group grow>
              <NumberInput
                label={t('Width')}
                value={Math.round(cropData.width)}
                onChange={(value) => handleInputChange('width', Number(value))}
                min={1}
                max={imageRef.current?.naturalWidth || 100}
              />
              <NumberInput
                label={t('Height')}
                value={Math.round(cropData.height)}
                onChange={(value) => handleInputChange('height', Number(value))}
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