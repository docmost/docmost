import { NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";
import { v4 as uuidv4 } from "uuid";
import classes from "./code-block.module.css";
import { useTranslation } from "react-i18next";
import { useComputedColorScheme } from "@mantine/core";
import { deflate } from "pako";
import { fromUint8Array } from "js-base64";
import panzoom from "svg-pan-zoom";
import Hammer from "hammerjs";

const DEFAULT_STATE = {
  code: "",
  mermaid: JSON.stringify({ theme: "default" }, undefined, 2),
  updateDiagram: true,
  rough: false,
};
const serializeState = (state: typeof DEFAULT_STATE) => {
  const json = JSON.stringify(state);
  const data = new TextEncoder().encode(json);
  const compressed = deflate(data, { level: 9 });
  return `pako:${fromUint8Array(compressed, true)}`;
};

interface MermaidViewProps {
  props: NodeViewProps;
  scale: number;
  position: { x: number; y: number };
  setScale: React.Dispatch<React.SetStateAction<number>>;
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  onLinkGenerated: (link: string) => void;
}

export default function MermaidView({
                                      props,
                                      scale,
                                      position,
                                      setScale,
                                      setPosition,
                                      onLinkGenerated,
                                    }: MermaidViewProps) {
  const { t } = useTranslation();
  const computedColorScheme = useComputedColorScheme();
  const { node } = props;
  const [preview, setPreview] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<any>(null);
  const hammerRef = useRef<HammerManager | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const throttleRef = useRef(0);
  const isMountedRef = useRef(true);
  const touchMoveListenerRef = useRef<((e: Event) => void) | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInternalUpdateRef = useRef(false); // Prevent feedback loops

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      suppressErrorRendering: true,
      theme: computedColorScheme === "light" ? "default" : "dark",
    });
  }, [computedColorScheme]);

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cleanup all resources on unmount
  useEffect(() => {
    return () => {
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Destroy pan-zoom
      if (panZoomRef.current) {
        try {
          panZoomRef.current.destroy();
        } catch (e) {
          // Ignore errors during cleanup
        }
        panZoomRef.current = null;
      }

      // Destroy hammer
      if (hammerRef.current) {
        try {
          hammerRef.current.destroy();
        } catch (e) {
          // Ignore errors during cleanup
        }
        hammerRef.current = null;
      }

      // Disconnect observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  // Setup pan-zoom on SVG element
  const setupPanZoom = useCallback((svgElement: SVGElement) => {
    // Cleanup existing instances
    if (panZoomRef.current) {
      try {
        panZoomRef.current.destroy();
      } catch (e) {
        // Ignore
      }
      panZoomRef.current = null;
    }
    if (hammerRef.current) {
      try {
        hammerRef.current.destroy();
      } catch (e) {
        // Ignore
      }
      hammerRef.current = null;
    }

    let initialScale = 1;
    let pannedX = 0;
    let pannedY = 0;

    // Initialize Hammer for touch gestures
    const hammer = new Hammer(svgElement);
    hammerRef.current = hammer;

    // Store touchmove listener reference for proper cleanup
    const touchMoveListener = (e: Event) => e.preventDefault();
    touchMoveListenerRef.current = touchMoveListener;

    // Initialize svg-pan-zoom
    const pzInstance = panzoom(svgElement, {
      center: true,
      controlIconsEnabled: false,
      customEventsHandler: {
        haltEventListeners: [
          "touchstart",
          "touchend",
          "touchmove",
          "touchleave",
          "touchcancel",
        ],
        init: function (options) {
          const instance = options.instance;

          const resetPanned = () => {
            pannedX = 0;
            pannedY = 0;
          };

          const handlePan = (event: HammerInput) => {
            instance.panBy({
              x: event.deltaX - pannedX,
              y: event.deltaY - pannedY,
            });
            pannedX = event.deltaX;
            pannedY = event.deltaY;
          };

          hammer.add(new Hammer.Pinch({ enable: true }));

          hammer.on("panstart panmove", function (event) {
            if (event.type === "panstart") {
              resetPanned();
            }
            handlePan(event);
          });

          hammer.on("pinchstart pinchmove", function (event) {
            if (event.type === "pinchstart") {
              initialScale = instance.getZoom();
              resetPanned();
            }
            instance.zoomAtPoint(initialScale * event.scale, {
              x: event.center.x,
              y: event.center.y,
            });
            handlePan(event);
          });

          // Add touchmove listener with proper reference
          options.svgElement.addEventListener(
            "touchmove",
            touchMoveListener,
            { passive: false },
          );
        },
        destroy: function (options) {
          // Properly remove touchmove listener
          if (touchMoveListenerRef.current && options?.svgElement) {
            options.svgElement.removeEventListener(
              "touchmove",
              touchMoveListenerRef.current,
            );
          }
          touchMoveListenerRef.current = null;

          if (hammerRef.current) {
            try {
              hammerRef.current.destroy();
            } catch (e) {
              // Ignore
            }
          }
          hammerRef.current = null;
        },
      },
      fit: true,
      maxZoom: 12,
      minZoom: 0.2,
      onPan: (pan) => {
        const now = performance.now();
        if (now - throttleRef.current > 50) {
          if (isMountedRef.current && !isInternalUpdateRef.current) {
            isInternalUpdateRef.current = true;
            setPosition({ x: pan.x, y: pan.y });
            // Reset flag after state update completes
            requestAnimationFrame(() => {
              isInternalUpdateRef.current = false;
            });
          }
          throttleRef.current = now;
        }
      },
      onZoom: (z) => {
        const now = performance.now();
        if (now - throttleRef.current > 50) {
          if (isMountedRef.current && !isInternalUpdateRef.current) {
            isInternalUpdateRef.current = true;
            setScale(z);
            // Reset flag after state update completes
            requestAnimationFrame(() => {
              isInternalUpdateRef.current = false;
            });
          }
          throttleRef.current = now;
        }
      },
      panEnabled: true,
      zoomEnabled: true,
      dblClickZoomEnabled: false,
    });

    panZoomRef.current = pzInstance;

    // Restore previous pan/zoom if exists
    if (scale !== 1 || position.x !== 0 || position.y !== 0) {
      isInternalUpdateRef.current = true;
      pzInstance.zoom(scale);
      pzInstance.pan(position);
      requestAnimationFrame(() => {
        isInternalUpdateRef.current = false;
      });
    } else {
      // Initial zoom: 100% (scale = 1.0)
      isInternalUpdateRef.current = true;
      pzInstance.zoom(1.0);
      pzInstance.center();

      // Update external state to match
      setScale(1.0);
      const currentPan = pzInstance.getPan();
      setPosition({ x: currentPan.x, y: currentPan.y });

      requestAnimationFrame(() => {
        isInternalUpdateRef.current = false;
      });
    }
  }, [setScale, setPosition]);

  // Render diagram with debouncing
  useEffect(() => {
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Cleanup observer before starting new render
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    const renderDiagram = () => {
      const id = `mermaid-${uuidv4()}`;

      if (node.textContent.length > 0) {
        mermaid
          .render(id, node.textContent)
          .then((item) => {
            // Check if component is still mounted
            if (!isMountedRef.current) return;

            setPreview(item.svg);

            const link = serializeState({
              ...DEFAULT_STATE,
              code: node.textContent,
            });

            onLinkGenerated(link);

            // Setup MutationObserver for SVG insertion - ensure only one observer
            if (observerRef.current) {
              observerRef.current.disconnect();
            }

            observerRef.current = new MutationObserver(() => {
              if (!containerRef.current || !isMountedRef.current) return;

              const svgElement = containerRef.current.querySelector("svg");
              if (svgElement && !panZoomRef.current) {
                setupPanZoom(svgElement);
                // Cleanup observer after successful setup
                if (observerRef.current) {
                  observerRef.current.disconnect();
                  observerRef.current = null;
                }
              }
            });

            if (containerRef.current && isMountedRef.current) {
              observerRef.current.observe(containerRef.current, {
                childList: true,
                subtree: true,
              });
            }
          })
          .catch((err) => {
            if (!isMountedRef.current) return;

            if (props.editor.isEditable) {
              setPreview(
                `<div class="${classes.error}">${t("Mermaid diagram error:")} ${
                  err instanceof Error ? err.message : String(err)
                }</div>`,
              );
            } else {
              setPreview(
                `<div class="${classes.error}">${t("Invalid Mermaid diagram")}</div>`,
              );
            }
            onLinkGenerated("");
          });
      } else {
        setPreview("");
        onLinkGenerated("");
      }
    };

    // Debounce diagram rendering (300ms delay when typing)
    if (props.editor.isEditable) {
      debounceTimerRef.current = setTimeout(renderDiagram, 300);
    } else {
      // Render immediately when not editing
      renderDiagram();
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [
    node.textContent,
    computedColorScheme,
    props.editor.isEditable,
    t,
    onLinkGenerated,
    setupPanZoom,
  ]);

  // Sync external zoom/pan controls with pan-zoom instance
  // This handles the zoom buttons clicks
  useEffect(() => {
    if (!panZoomRef.current || isInternalUpdateRef.current) return;

    const currentZoom = panZoomRef.current.getZoom();
    const currentPan = panZoomRef.current.getPan();

    // Only update if there's a significant difference
    const zoomDiff = Math.abs(currentZoom - scale);
    const panXDiff = Math.abs(currentPan.x - position.x);
    const panYDiff = Math.abs(currentPan.y - position.y);

    if (zoomDiff > 0.01 || panXDiff > 1 || panYDiff > 1) {
      isInternalUpdateRef.current = true;

      // Apply zoom first
      if (zoomDiff > 0.01) {
        panZoomRef.current.zoom(scale);
      }

      // Then apply pan
      if (panXDiff > 1 || panYDiff > 1) {
        panZoomRef.current.pan(position);
      }

      // Reset flag after updates complete
      requestAnimationFrame(() => {
        isInternalUpdateRef.current = false;
      });
    }
  }, [scale, position]);

  // Prevent window scroll on wheel events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventScroll = (e: WheelEvent) => {
      if (panZoomRef.current) {
        e.preventDefault();
      } else if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    container.addEventListener("wheel", preventScroll, { passive: false });

    return () => {
      container.removeEventListener("wheel", preventScroll);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={classes.mermaid}
      contentEditable={false}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        overflow: "hidden",
        position: "relative",
        userSelect: "none",
        touchAction: "none",
      }}
      role="img"
      aria-label={t("Mermaid diagram")}
    >
      <div
        className="diagram-preview"
        dangerouslySetInnerHTML={{ __html: preview }}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      />
    </div>
  );
}
