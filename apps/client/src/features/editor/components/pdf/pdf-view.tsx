import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";
import { Document, Page, pdfjs } from "react-pdf";
import { useLocation } from "react-router-dom";
import {
  ActionIcon, 
  Group, 
  NumberInput, 
  Text, 
  Button,
  Tooltip,
  Paper,
  Stack,
  TextInput,
  Switch,
  Slider,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconZoomIn,
  IconZoomOut,
  IconLock,
  IconLockOpen,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconLayout,
  IconBrowser,
  IconFileText,
} from "@tabler/icons-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
interface PdfViewProps extends NodeViewProps {
  node: NodeViewProps['node'] & {
    attrs: {
      src?: string;
      width?: string;
      height?: string;
      align?: string;
      title?: string;
      pageNum?: number;
      pageRange?: string;
      totalPages?: number;
      locked?: boolean;
      scale?: number;
      floating?: boolean;
      browserView?: boolean;
    };
  };
}

export default function PdfView(props: PdfViewProps) {
  const { node, selected, updateAttributes } = props;
  const { colorScheme } = useMantineColorScheme();
  const location = useLocation();
  
  const isSharedPage = useMemo(() => {
    return location.pathname.includes('/share/');
  }, [location.pathname]);
  
  const { 
    src, 
    width, 
    height, 
    align = "center", 
    title, 
    pageNum = 1, 
    pageRange, 
    totalPages, 
    locked = false,
    scale = 1.0,
    floating = false,
    browserView = false
  } = node.attrs;

  const [numPages, setNumPages] = useState<number>(totalPages || 0);
  const [currentPage, setCurrentPage] = useState<number>(pageNum);
  const [currentScale, setCurrentScale] = useState<number>(scale);
  const [isLocked, setIsLocked] = useState<boolean>(locked);
  const [pageRangeValue, setPageRangeValue] = useState<string>(pageRange || "");
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(selected);
  const [isFloating, setIsFloating] = useState<boolean>(floating);
  const [isBrowserView, setIsBrowserView] = useState<boolean>(browserView);
  const [browserHeight, setBrowserHeight] = useState<string>(height || "600px");
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setCurrentPage(pageNum);
  }, [pageNum]);

  useEffect(() => {
    setCurrentScale(scale);
  }, [scale]);

  useEffect(() => {
    setIsLocked(locked);
  }, [locked]);

  useEffect(() => {
    setPageRangeValue(pageRange || "");
  }, [pageRange]);

  useEffect(() => {
    setIsFloating(floating);
  }, [floating]);

  useEffect(() => {
    setIsBrowserView(browserView);
  }, [browserView]);

  useEffect(() => {
    if (totalPages !== numPages && totalPages) {
      setNumPages(totalPages);
    }
  }, [totalPages]);

  const alignClass = useMemo(() => {
    if (align === "left") return "alignLeft";
    if (align === "right") return "alignRight";
    if (align === "center") return "alignCenter";
    return "alignCenter";
  }, [align]);

  useEffect(() => {
    setIsControlsVisible(selected);
  }, [selected]);

  useEffect(() => {
    if (totalPages !== numPages) {
      updateAttributes({ totalPages: numPages });
    }
  }, [numPages, totalPages, updateAttributes]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages: loadedPages }: { numPages: number }) => {
    setNumPages(loadedPages);
    if (!totalPages) {
      updateAttributes({ totalPages: loadedPages });
    }
  }, [totalPages, updateAttributes, src]);

  const handlePageChange = useCallback((newPage: number) => {
    if (isLocked) return;
    
    const validPage = Math.max(1, Math.min(newPage, numPages));
    setCurrentPage(validPage);
    updateAttributes({ pageNum: validPage });
  }, [isLocked, numPages, updateAttributes]);

  const handleScaleChange = useCallback((newScale: number) => {
    if (isLocked) return;

    const roundedScale = Math.round(newScale / 0.05) * 0.05;
    const validScale = Math.max(0.35, Math.min(1.0, Number(roundedScale.toFixed(2))));
    setCurrentScale(validScale);
    updateAttributes({ scale: validScale });
  }, [isLocked, updateAttributes]);

  const handleScaleChangeEnd = useCallback((newScale: number) => {
    if (isLocked) return;

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    const roundedScale = Math.round(newScale / 0.05) * 0.05;
    const validScale = Math.max(0.35, Math.min(1.0, Number(roundedScale.toFixed(2))));
    updateAttributes({ scale: validScale });
  }, [isLocked, updateAttributes]);

  const handleLockToggle = useCallback(() => {
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    updateAttributes({ locked: newLocked });
  }, [isLocked, updateAttributes]);

  const handlePageRangeChange = useCallback((range: string) => {
    if (isLocked) return;
    
    setPageRangeValue(range);
    updateAttributes({ pageRange: range });
  }, [isLocked, updateAttributes]);

  const handleAlignmentChange = useCallback((newAlign: string) => {
    if (isLocked) return;
    
    updateAttributes({ align: newAlign });
  }, [isLocked, updateAttributes]);

  const handleFloatingToggle = useCallback(() => {
    if (isLocked) return;
    
    const newFloating = !isFloating;
    setIsFloating(newFloating);
    updateAttributes({ floating: newFloating });
  }, [isLocked, isFloating, updateAttributes]);

  const handleBrowserViewToggle = useCallback(() => {
    if (isLocked) return;
    
    const newBrowserView = !isBrowserView;
    setIsBrowserView(newBrowserView);
    updateAttributes({ browserView: newBrowserView });
  }, [isLocked, isBrowserView, updateAttributes]);

  const handleBrowserHeightChange = useCallback((newHeight: string) => {
    if (isLocked) return;
    
    setBrowserHeight(newHeight);
    updateAttributes({ height: newHeight });
  }, [isLocked, updateAttributes]);

  const parsePageRange = useCallback((range: string): number[] => {
    if (!range) return [];
    
    const pages: number[] = [];
    const parts = range.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(numPages, end); i++) {
            if (!pages.includes(i)) pages.push(i);
          }
        }
      } else {
        const pageNum = parseInt(trimmed);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= numPages && !pages.includes(pageNum)) {
          pages.push(pageNum);
        }
      }
    }
    
    return pages.sort((a, b) => a - b);
  }, [numPages]);

  const pagesToRender = useMemo(() => {
    if (pageRangeValue) {
      return parsePageRange(pageRangeValue);
    }
    return [currentPage];
  }, [pageRangeValue, currentPage, parsePageRange]);

  const renderControls = () => {
    if (!selected) return null;

    if (isSharedPage) {
      if (isLocked || pageRangeValue) return null;

      return (
        <Paper 
          p="xs" 
          shadow="sm" 
          style={{ 
            position: "absolute", 
            top: 8, 
            right: 8, 
            zIndex: 10,
            backgroundColor: colorScheme === 'dark' ? 'rgba(37, 38, 43, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <Group gap="xs">
            <ActionIcon
              variant="light"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              size="sm"
            >
              <IconChevronLeft size={14} />
            </ActionIcon>
            
            <NumberInput
              value={currentPage}
              onChange={(value) => handlePageChange(Number(value) || 1)}
              min={1}
              max={numPages}
              size="xs"
              w={60}
              hideControls
            />
            
            <Text size="xs">/ {numPages}</Text>
            
            <ActionIcon
              variant="light"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= numPages}
              size="sm"
            >
              <IconChevronRight size={14} />
            </ActionIcon>
          </Group>
        </Paper>
      );
    }

    return (
      <Paper 
        p="xs" 
        shadow="sm" 
        style={{ 
          position: "absolute", 
          top: 8, 
          right: 8, 
          zIndex: 10,
          backgroundColor: colorScheme === 'dark' ? 'rgba(37, 38, 43, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <Stack gap="xs">
          <Group gap="xs">
            <Tooltip label={isLocked ? "Unlock PDF" : "Lock PDF"}>
              <ActionIcon
                variant={isLocked ? "filled" : "light"}
                color={isLocked ? "red" : "gray"}
                onClick={handleLockToggle}
                size="sm"
              >
                {isLocked ? <IconLock size={14} /> : <IconLockOpen size={14} />}
              </ActionIcon>
            </Tooltip>
            
            {!isLocked && !isBrowserView && (
              <>
                <ActionIcon
                  variant="light"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || !!pageRangeValue}
                  size="sm"
                >
                  <IconChevronLeft size={14} />
                </ActionIcon>
                
                <NumberInput
                  value={currentPage}
                  onChange={(value) => handlePageChange(Number(value) || 1)}
                  min={1}
                  max={numPages}
                  size="xs"
                  w={60}
                  hideControls
                  disabled={!!pageRangeValue}
                />
                
                <Text size="xs">/ {numPages}</Text>
                
                <ActionIcon
                  variant="light"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= numPages || !!pageRangeValue}
                  size="sm"
                >
                  <IconChevronRight size={14} />
                </ActionIcon>
              </>
            )}
          </Group>

          {
            !isLocked && isBrowserView && (
                  <TextInput
                    placeholder="Height (e.g., 600px, 80vh)"
                    value={browserHeight}
                    onChange={(e) => handleBrowserHeightChange(e.target.value)}
                    size="xs"
                    style={{ width: 200 }}
                    label="Height"
                  />
                )
          }
          
          {!isLocked && (
            <>
              <Group gap="xs">
                <ActionIcon
                  variant="light"
                  onClick={() => handleScaleChange(currentScale - 0.05)}
                  disabled={currentScale <= 0.35}
                  size="sm"
                >
                  <IconZoomOut size={14} />
                </ActionIcon>

                <Slider
                  value={currentScale}
                  onChangeEnd={handleScaleChangeEnd}
                  min={0.35}
                  max={1.0}
                  step={0.05}
                  w={80}
                  size="sm"
                />

                <ActionIcon
                  variant="light"
                  onClick={() => handleScaleChange(currentScale + 0.05)}
                  disabled={currentScale >= 1.0}
                  size="sm"
                >
                  <IconZoomIn size={14} />
                </ActionIcon>
              </Group>

              {!isBrowserView && (
                <TextInput
                  placeholder="Page range (e.g., 1-3,5,7)"
                  value={pageRangeValue}
                  onChange={(e) => handlePageRangeChange(e.target.value)}
                  size="xs"
                  style={{ width: 200 }}
                />
              )}

              <Group gap="xs">
                {/* Alignment buttons and floating toggle remain available in browser view */}
                <Button.Group>
                  <Button
                    size="xs"
                    variant={align === 'left' ? 'filled' : 'light'}
                    onClick={() => handleAlignmentChange('left')}
                  >
                    <IconAlignLeft size={14} />
                  </Button>
                  <Button
                    size="xs"
                    variant={align === 'center' ? 'filled' : 'light'}
                    onClick={() => handleAlignmentChange('center')}
                  >
                    <IconAlignCenter size={14} />
                  </Button>
                  <Button
                    size="xs"
                    variant={align === 'right' ? 'filled' : 'light'}
                    onClick={() => handleAlignmentChange('right')}
                  >
                    <IconAlignRight size={14} />
                  </Button>
                </Button.Group>

                <ActionIcon
                  variant={isFloating ? 'filled' : 'light'}
                  onClick={handleFloatingToggle}
                  size="sm"
                  title="Toggle floating"
                >
                  <IconLayout size={14} />
                </ActionIcon>

                <ActionIcon
                  variant={isBrowserView ? 'filled' : 'light'}
                  onClick={handleBrowserViewToggle}
                  size="sm"
                  title="Toggle browser view"
                >
                  {isBrowserView ? <IconFileText size={14} /> : <IconBrowser size={14} />}
                </ActionIcon>
              </Group>
            </>
          )}
        </Stack>
      </Paper>
    );
  };

  return (
    <NodeViewWrapper>
      <div
        className={clsx(
          selected ? "ProseMirror-selectednode" : "",
          alignClass,
          "pdf-wrapper"
        )}
        style={{ 
          display: isFloating && (align === 'left' || align === 'right') ? "inline-block" : "flex",
          flexDirection: "column",
          alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
          width: isFloating && (align === 'left' || align === 'right') ? `${scale * 100}%` : "100%",
          maxWidth: "100%",
          float: isFloating && (align === 'left' || align === 'right') ? align as 'left' | 'right' : 'none',
          margin: isFloating && (align === 'left' || align === 'right') 
            ? (align === 'left' ? '0 1rem 1rem 0' : '0 0 1rem 1rem')
            : align === 'left' ? '0 auto 0 0' : align === 'right' ? '0 0 0 auto' : '0 auto',
          position: "relative",
        }}
        onMouseEnter={() => !isLocked && !isSharedPage && setIsControlsVisible(true)}
        onMouseLeave={() => !selected && !isSharedPage && setIsControlsVisible(false)}
      >
        {renderControls()}
        
        {isBrowserView ? (
          <iframe
            src={getFileUrl(src)}
            style={{
              width: width || '100%',
              height: browserHeight,
              border: colorScheme === 'dark' ? '1px solid #373A40' : '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: colorScheme === 'dark' ? '#2C2E33' : '#ffffff'
            }}
            title={title || 'PDF Document'}
          />
        ) : (
          <>
        <Document
          file={getFileUrl(src)}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(error) => {
            console.error("PDF load error:", error);
            console.log("Failed PDF src:", src);
            console.log("Failed PDF URL:", getFileUrl(src));
          }}
          loading={
            <div style={{ 
              height: height || "600px", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              border: colorScheme === 'dark' ? '1px solid #373A40' : '1px solid #ddd',
              borderRadius: "4px",
              backgroundColor: colorScheme === 'dark' ? '#25262B' : '#f8f9fa'
            }}>
              <Text>Loading PDF...</Text>
            </div>
          }
          error={
            <div style={{ 
              height: height || "600px", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              border: colorScheme === 'dark' ? '1px solid #373A40' : '1px solid #ddd',
              borderRadius: "4px",
              backgroundColor: colorScheme === 'dark' ? '#2C2E33' : '#fff5f5'
            }}>
              <Text color="red">Failed to load PDF</Text>
            </div>
          }
        >
        
        <div style={{
          width: "100%",
          maxWidth: '100%',
          display: "flex",
          flexDirection: "column",
          alignItems: !isFloating && (align === "left" || align === "right") ? "flex-start" : !isFloating && align === "right" ? "flex-end" : "center",
          overflow: "hidden",
          margin: isFloating ? '0' : (align === 'left' ? '0 auto 0 0' : align === 'right' ? '0 0 0 auto' : '0 auto'),
        }}>
          {pagesToRender.map((pageNumber) => (
            <div
              key={pageNumber}
              style={{
                marginBottom: pagesToRender.length > 1 ? 16 : 0,
                border: colorScheme === 'dark' ? '1px solid #373A40' : '1px solid #ddd',
                borderRadius: "4px",
                display: "block",
                justifyContent: !isFloating && (align === "left" || align === "right") ? "flex-start" : !isFloating && align === "right" ? "flex-end" : "center",
                overflow: "hidden",
                backgroundColor: colorScheme === 'dark' ? '#2C2E33' : '#ffffff',
                boxShadow: colorScheme === 'dark' ? '0 2px 8px rgba(0, 0, 0, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}
            >
              <Page
                pageNumber={pageNumber}
                scale={currentScale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
          ))}
        </div>
        </Document>
        </>
        )}
        
        {title && (
          <div
            style={{
              fontSize: "0.875rem",
              color: colorScheme === 'dark' ? '#909296' : '#666',
              textAlign: "center",
              marginTop: "8px",
            }}
          >
            {title}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}