import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";
import { Document, Page, pdfjs } from "react-pdf";
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
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconZoomIn,
  IconZoomOut,
  IconLock,
  IconLockOpen,
  IconMaximize,
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
    };
  };
}

export default function PdfView(props: PdfViewProps) {
  const { node, selected, updateAttributes } = props;
  const { 
    src, 
    width, 
    height, 
    align, 
    title, 
    pageNum = 1, 
    pageRange, 
    totalPages, 
    locked = false,
    scale = 1.0 
  } = node.attrs;

  const [numPages, setNumPages] = useState<number>(totalPages || 0);
  const [currentPage, setCurrentPage] = useState<number>(pageNum);
  const [currentScale, setCurrentScale] = useState<number>(scale);
  const [isLocked, setIsLocked] = useState<boolean>(locked);
  const [pageRangeValue, setPageRangeValue] = useState<string>(pageRange || "");
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(selected);
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
    
    const validScale = Math.max(0.5, Math.min(3.0, newScale));
    setCurrentScale(validScale);
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
    if (!isControlsVisible && isLocked) return null;

    return (
      <Paper 
        p="xs" 
        shadow="sm" 
        style={{ 
          position: "absolute", 
          top: 8, 
          right: 8, 
          zIndex: 10,
          backgroundColor: "rgba(255, 255, 255, 0.95)"
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
            
            {!isLocked && (
              <>
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
              </>
            )}
          </Group>
          
          {!isLocked && (
            <>
              <Group gap="xs">
                <ActionIcon
                  variant="light"
                  onClick={() => handleScaleChange(currentScale - 0.1)}
                  disabled={currentScale <= 0.5}
                  size="sm"
                >
                  <IconZoomOut size={14} />
                </ActionIcon>
                
                <Slider
                  value={currentScale}
                  onChange={handleScaleChange}
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  w={80}
                  size="sm"
                />
                
                <ActionIcon
                  variant="light"
                  onClick={() => handleScaleChange(currentScale + 0.1)}
                  disabled={currentScale >= 3.0}
                  size="sm"
                >
                  <IconZoomIn size={14} />
                </ActionIcon>
              </Group>
              
              <TextInput
                placeholder="Page range (e.g., 1-3,5,7)"
                value={pageRangeValue}
                onChange={(e) => handlePageRangeChange(e.target.value)}
                size="xs"
                style={{ width: 200 }}
              />
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
          display: "block",
          width: width || "100%",
          position: "relative",
        }}
        onMouseEnter={() => !isLocked && setIsControlsVisible(true)}
        onMouseLeave={() => !selected && setIsControlsVisible(false)}
      >
        {renderControls()}
        
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
              border: "1px solid #ddd",
              borderRadius: "4px",
              backgroundColor: "#f8f9fa"
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
              border: "1px solid #ddd",
              borderRadius: "4px",
              backgroundColor: "#fff5f5"
            }}>
              <Text color="red">Failed to load PDF</Text>
            </div>
          }
        >
          {pagesToRender.map((pageNumber) => (
            <div
              key={pageNumber}
              style={{
                marginBottom: pagesToRender.length > 1 ? 16 : 0,
                border: "1px solid #ddd",
                borderRadius: "4px",
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
        </Document>
        
        {title && (
          <div
            style={{
              fontSize: "0.875rem",
              color: "#666",
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