import { Flex, Box, useComputedColorScheme } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import ForceGraph2D, {
  GraphData,
  LinkObject,
  NodeObject,
} from "react-force-graph-2d";
import { useGetSpaceGraph } from "../queries/space-query";
import { IGraphDataLink, IGraphDataNode } from "../types/space.types";
import { buildPageUrl } from "@/features/page/page.utils";
import { useNavigate } from "react-router-dom";

const GRAPH_CONFIG = {
  label: {
    baseSize: 11,
    maxSize: 15,
    minSize: 9,
    strokeSize: 2,
    paddingX: 0,
    paddingY: 6,
    maxOpacity: 1,
    minOpacity: 0.7,
    zoomThreshold: 0.4,
    zoomScaleFactor: 0.8,
  },
  node: {
    minSize: 3,
    maxSize: 8,
    baseBorder: 1.2,
    maxBorder: 2,
    hoverScale: 1.1,
  },
  link: {
    width: 1,
    highlightWidth: 2,
    arrowLength: 4,
    opacity: 0.3,
    highlightOpacity: 0.8,
    dimOpacity: 0.1,
    particle: {
      number: 0,
      highlightNumber: 1,
      width: 2,
      highlightWidth: 3,
      speed: 0.008,
    },
  },
  colors: {
    light: {
      parent: "#4285F4",
      backlink: "#EA4335",
      parentNotHighlight: "rgba(66, 133, 244, 0.15)",
      backlinkNotHighlight: "rgba(234, 67, 53, 0.15)",
      node: "#5f6368",
      nodeBorder: "#dadce0",
      nodeBorderHover: "#4285F4",
      nodeBorderHighlight: "#34A853",
      nodeNotHighlight: "#9aa0a6",
      nodeBorderNotHighlight: "#f1f3f4",
      nodeHover: "#1a73e8",
      text: "#202124",
      textBorder: "rgba(255, 255, 255, 0.9)",
      textHighlight: "#1a73e8",
      textDimmed: "#9aa0a6",
    },
    dark: {
      parent: "#7db46c",
      backlink: "#e06c75",
      parentNotHighlight: "rgba(125, 180, 108, 0.2)",
      backlinkNotHighlight: "rgba(224, 108, 117, 0.2)",
      node: "#9aa0a6",
      nodeBorder: "#5f6368",
      nodeBorderHover: "#7db46c",
      nodeBorderHighlight: "#98c379",
      nodeNotHighlight: "#5f6368",
      nodeBorderNotHighlight: "#3c4043",
      nodeHover: "#98c379",
      text: "#e8eaed",
      textBorder: "rgba(32, 33, 36, 0.9)",
      textHighlight: "#98c379",
      textDimmed: "#9aa0a6",
    },
  },
};

function assignCurvature(
  links: LinkObject<IGraphDataNode, IGraphDataLink>[]
): LinkObject<IGraphDataNode, IGraphDataLink>[] {
  const groupedLinks: Record<string, LinkObject<IGraphDataNode, IGraphDataLink>[]> = {};

  links.forEach((link) => {
    const key = `${link.source}|${link.target}`;
    if (!groupedLinks[key]) groupedLinks[key] = [];
    groupedLinks[key].push(link);
  });

  Object.values(groupedLinks).forEach(
    (group) => {
      const len = group.length;
      group.forEach((link, i) => {
        const spread = 0.3;
        if (len === 1) {
          link.curvature = 0;
        } else {
          link.curvature = spread * (i / (len - 1) - 0.5) * 2;
        }
      });
    }
  );

  return links;
}

export default function Graph({ space }) {
  const navigate = useNavigate();
  const computedColorScheme = useComputedColorScheme();
  const { ref, width, height } = useElementSize();
  const graphRef = useRef<any>();
  const {
    data: graphData,
    isFetching,
    refetch,
  } = useGetSpaceGraph(space.id);

  const [data, setData] = useState<GraphData<IGraphDataNode, IGraphDataLink>>();
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [hoverLinkId, setHoverLinkId] = useState<string | null>(null);

  const colors = useMemo(
    () => GRAPH_CONFIG.colors[computedColorScheme],
    [computedColorScheme]
  );

  const { nodeMap, linkMap, connectionStats } = useMemo(() => {
    if (!data) return { nodeMap: new Map(), linkMap: new Map(), connectionStats: { max: 1, min: 0 } };

    const nodeMap = new Map<string, NodeObject<IGraphDataNode>>();
    const linkMap = new Map<string, LinkObject<IGraphDataNode, IGraphDataLink>>();
    
    data.nodes.forEach((node) => {
      nodeMap.set(node.id as string, node);
    });

    data.links.forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeObject<IGraphDataNode>).id as string;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeObject<IGraphDataNode>).id as string;
      const linkId = `${sourceId}-${targetId}-${link.type}`;
      linkMap.set(linkId, link);
    });

    const connectionCounts = data.nodes.map(node => node.neighbors?.size || 0);
    const connectionStats = {
      max: Math.max(...connectionCounts, 1),
      min: Math.min(...connectionCounts, 0),
    };

    return { nodeMap, linkMap, connectionStats };
  }, [data]);

  const highlightData = useMemo(() => {
    if (!hoverNodeId && !hoverLinkId) {
      return { 
        directNodes: new Set<string>(), 
        directLinks: new Set<string>()
      };
    }

    const directNodes = new Set<string>();
    const directLinks = new Set<string>();

    if (hoverNodeId) {
      directNodes.add(hoverNodeId);
      
      if (data) {
        data.links.forEach((link) => {
          const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeObject<IGraphDataNode>).id as string;
          const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeObject<IGraphDataNode>).id as string;
          
          if (sourceId === hoverNodeId || targetId === hoverNodeId) {
            if (sourceId === hoverNodeId) {
              directNodes.add(targetId);
            } else {
              directNodes.add(sourceId);
            }
            
            const linkId = `${sourceId}-${targetId}-${link.type}`;
            directLinks.add(linkId);
          }
        });
      }
    }

    if (hoverLinkId) {
      const link = linkMap.get(hoverLinkId);
      if (link) {
        directLinks.add(hoverLinkId);
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeObject<IGraphDataNode>).id as string;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeObject<IGraphDataNode>).id as string;
        directNodes.add(sourceId);
        directNodes.add(targetId);
      }
    }

    return { directNodes, directLinks };
  }, [hoverNodeId, hoverLinkId, data, linkMap]);

  const getLinkColor = useCallback(
    (link: LinkObject<IGraphDataNode, IGraphDataLink>) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeObject<IGraphDataNode>).id as string;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeObject<IGraphDataNode>).id as string;
      const linkId = `${sourceId}-${targetId}-${link.type}`;
      const isDirectHighlight = highlightData.directLinks.has(linkId);
      const shouldDim = (hoverNodeId || hoverLinkId) && !isDirectHighlight;

      if (link.type === "backlink") {
        if (shouldDim) return colors.backlinkNotHighlight;
        return isDirectHighlight ? colors.backlink : colors.backlinkNotHighlight;
      }

      if (shouldDim) return colors.parentNotHighlight;
      return isDirectHighlight ? colors.parent : colors.parentNotHighlight;
    },
    [highlightData.directLinks, hoverNodeId, hoverLinkId, colors]
  );

  const getNodeSize = useCallback(
    (node: NodeObject<IGraphDataNode>, isHovered: boolean = false, globalScale: number = 1) => {
      const connectionCount = node.neighbors?.size || 0;
      const normalizedSize = connectionStats.max > connectionStats.min
        ? (connectionCount - connectionStats.min) / (connectionStats.max - connectionStats.min)
        : 0.5;

      const baseNodeSize = GRAPH_CONFIG.node.minSize +
        (GRAPH_CONFIG.node.maxSize - GRAPH_CONFIG.node.minSize) * normalizedSize;
      
      const nodeSize = isHovered 
        ? baseNodeSize * GRAPH_CONFIG.node.hoverScale 
        : baseNodeSize;

      const borderSize = GRAPH_CONFIG.node.baseBorder +
        (GRAPH_CONFIG.node.maxBorder - GRAPH_CONFIG.node.baseBorder) * normalizedSize;

      const baseTextSize = GRAPH_CONFIG.label.minSize +
        (GRAPH_CONFIG.label.maxSize - GRAPH_CONFIG.label.minSize) * normalizedSize * 0.6;
      
      const zoomAdjustedTextSize = baseTextSize * Math.pow(globalScale, GRAPH_CONFIG.label.zoomScaleFactor);
      const labelSize = Math.max(GRAPH_CONFIG.label.minSize * 0.5, zoomAdjustedTextSize);

      return { nodeSize, borderSize, labelSize };
    },
    [connectionStats.max, connectionStats.min]
  );

  const nodePointerAreaPaint = useCallback(
    (
      node: NodeObject<IGraphDataNode>,
      paintColor: string,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const { nodeSize, borderSize } = getNodeSize(node, false, globalScale);
      
      const clickableRadius = Math.max(nodeSize + borderSize + 3, 8);
      
      ctx.fillStyle = paintColor;
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, clickableRadius, 0, 2 * Math.PI, false);
      ctx.fill();
    },
    [getNodeSize]
  );

  const getLinkDirectionalArrowRelPos = useCallback(
    (link: LinkObject<IGraphDataNode, IGraphDataLink>) => {
      const sourceNode = typeof link.source === 'string'
        ? nodeMap.get(link.source)
        : link.source as NodeObject<IGraphDataNode>;
      const targetNode = typeof link.target === 'string'
        ? nodeMap.get(link.target)
        : link.target as NodeObject<IGraphDataNode>;

      if (!sourceNode || !targetNode || !sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) return 0.5;

      const { nodeSize: sourceNodeSize, borderSize: sourceBorderSize } = getNodeSize(sourceNode, false, 1);
      const { nodeSize: targetNodeSize, borderSize: targetBorderSize } = getNodeSize(targetNode, false, 1);

      const sourceRadius = sourceNodeSize + sourceBorderSize;
      const targetRadius = targetNodeSize + targetBorderSize;

      const linkLength = Math.sqrt(
        Math.pow(targetNode.x - sourceNode.x, 2) +
        Math.pow(targetNode.y - sourceNode.y, 2)
      );
      if (linkLength === 0) return 0.5;

      const arrowDistanceFromSource = sourceRadius + (linkLength - sourceRadius - targetRadius) / 2;
      return Math.max(0.1, Math.min(0.9, arrowDistanceFromSource / linkLength));
    },
    [nodeMap, getNodeSize]
  );

  const paint = useCallback(
    (
      node: NodeObject<IGraphDataNode>,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const nodeId = node.id as string;
      const isHovered = nodeId === hoverNodeId;
      const isDirectHighlight = highlightData.directNodes.has(nodeId);
      const shouldDim = (hoverNodeId || hoverLinkId) && !isDirectHighlight && !isHovered;

      let borderColor = colors.nodeBorder;
      let fillColor = colors.node;

      if (isHovered) {
        borderColor = colors.nodeBorderHover;
        fillColor = colors.nodeHover;
      } else if (isDirectHighlight) {
        borderColor = colors.nodeBorderHighlight;
        fillColor = colors.node;
      } else if (shouldDim) {
        borderColor = colors.nodeBorderNotHighlight;
        fillColor = colors.nodeNotHighlight;
      }

      const { nodeSize, borderSize, labelSize } = getNodeSize(node, isHovered, globalScale);

      ctx.beginPath();
      ctx.arc(node.x!, node.y!, nodeSize + borderSize, 0, 2 * Math.PI, false);
      ctx.fillStyle = borderColor;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(node.x!, node.y!, nodeSize, 0, 2 * Math.PI, false);
      ctx.fillStyle = fillColor;
      ctx.fill();

      const shouldShowLabel = globalScale > GRAPH_CONFIG.label.zoomThreshold || 
                             isHovered || 
                             isDirectHighlight;

      if (shouldShowLabel) {
        const fontSize = labelSize / globalScale;
        ctx.font = `${isHovered ? 'bold' : 'normal'} ${fontSize}px Sans-Serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        let textOpacity = GRAPH_CONFIG.label.minOpacity;
        if (isHovered || isDirectHighlight) {
          textOpacity = GRAPH_CONFIG.label.maxOpacity;
        } else if (shouldDim) {
          textOpacity = GRAPH_CONFIG.label.minOpacity * 0.5;
        } else {
          textOpacity = Math.min(
            GRAPH_CONFIG.label.maxOpacity,
            Math.max(GRAPH_CONFIG.label.minOpacity, globalScale)
          );
        }

        ctx.lineWidth = GRAPH_CONFIG.label.strokeSize / globalScale;
        ctx.strokeStyle = colors.textBorder;
        ctx.globalAlpha = textOpacity;
        ctx.strokeText(
          node.title!,
          node.x! + GRAPH_CONFIG.label.paddingX,
          node.y! + nodeSize + borderSize + GRAPH_CONFIG.label.paddingY
        );

        let textColor = colors.text;
        if (isHovered || isDirectHighlight) {
          textColor = colors.textHighlight;
        } else if (shouldDim) {
          textColor = colors.textDimmed;
        }

        ctx.fillStyle = textColor;
        ctx.fillText(
          node.title!,
          node.x! + GRAPH_CONFIG.label.paddingX,
          node.y! + nodeSize + borderSize + GRAPH_CONFIG.label.paddingY
        );

        ctx.globalAlpha = 1;
      }
    },
    [hoverNodeId, hoverLinkId, highlightData, colors, getNodeSize]
  );

  const handleNodeHover = useCallback(
    (node: NodeObject<IGraphDataNode> | null) => {
      const nodeId = node?.id as string | null;
      if (nodeId !== hoverNodeId) {
        setHoverNodeId(nodeId);
        setHoverLinkId(null);
      }
    },
    [hoverNodeId]
  );

  const handleLinkHover = useCallback(
    (link: LinkObject<IGraphDataNode, IGraphDataLink> | null) => {
      const linkId = link ? (() => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeObject<IGraphDataNode>).id as string;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeObject<IGraphDataNode>).id as string;
        return `${sourceId}-${targetId}-${link.type}`;
      })() : null;
      if (linkId !== hoverLinkId) {
        setHoverLinkId(linkId);
        setHoverNodeId(null);
      }
    },
    [hoverLinkId]
  );

  const handleNodeClick = useCallback(
    (node: NodeObject<IGraphDataNode>) => {
      if (node) {
        navigate(buildPageUrl(space.slug, node.slugId!, node.title!));
      }
    },
    [navigate, space.slug]
  );

  const getLinkWidth = useCallback(
    (link: LinkObject<IGraphDataNode, IGraphDataLink>) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeObject<IGraphDataNode>).id as string;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeObject<IGraphDataNode>).id as string;
      const linkId = `${sourceId}-${targetId}-${link.type}`;
      return highlightData.directLinks.has(linkId) ? GRAPH_CONFIG.link.highlightWidth : GRAPH_CONFIG.link.width;
    },
    [highlightData.directLinks]
  );

  const getLinkParticles = useCallback(
    (link: LinkObject<IGraphDataNode, IGraphDataLink>) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeObject<IGraphDataNode>).id as string;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeObject<IGraphDataNode>).id as string;
      const linkId = `${sourceId}-${targetId}-${link.type}`;
      return highlightData.directLinks.has(linkId) ? GRAPH_CONFIG.link.particle.highlightNumber : GRAPH_CONFIG.link.particle.number;
    },
    [highlightData.directLinks]
  );

  const getLinkParticleWidth = useCallback(
    (link: LinkObject<IGraphDataNode, IGraphDataLink>) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeObject<IGraphDataNode>).id as string;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeObject<IGraphDataNode>).id as string;
      const linkId = `${sourceId}-${targetId}-${link.type}`;
      return highlightData.directLinks.has(linkId) ? GRAPH_CONFIG.link.particle.highlightWidth : GRAPH_CONFIG.link.particle.width;
    },
    [highlightData.directLinks]
  );

  useEffect(() => {
    setData(undefined);
    refetch();
  }, []);

  useEffect(() => {
    if (graphData && !isFetching) {
      const links: LinkObject<IGraphDataNode, IGraphDataLink>[] = [
        ...graphData
          .filter((page) => page.parentPageId !== null)
          .map((page) => ({
            source: page.parentPageId!,
            target: page.id,
            type: "parent" as const,
          })),
        ...graphData.flatMap((page) => {
          if (!page.backlinks || page.backlinks.length === 0) return [];
          return page.backlinks.map((backlink) => ({
            source: backlink.sourcePageId,
            target: backlink.targetPageId,
            type: "backlink" as const,
          }));
        }),
      ];

      const nodeMap = new Map<string, NodeObject<IGraphDataNode>>();
      graphData.forEach((page) =>
        nodeMap.set(page.id, {
          id: page.id,
          slugId: page.slugId,
          title: page.title || "untitled",
          neighbors: new Set(),
          links: new Set(),
        })
      );

      links.forEach((link) => {
        const sourceNode = nodeMap.get(link.source as string);
        const targetNode = nodeMap.get(link.target as string);

        if (sourceNode && targetNode) {
          sourceNode.neighbors!.add(targetNode);
          sourceNode.links!.add(link);
          targetNode.neighbors!.add(sourceNode);
          targetNode.links!.add(link);
        }
      });

      const tempData = {
        nodes: Array.from(nodeMap.values()),
        links: assignCurvature(links),
      };

      setData(tempData);
    }
  }, [graphData, isFetching]);

  useEffect(() => {
    if (data && graphRef.current) {
      graphRef.current.d3Force("charge")?.strength(-40);
      // It prevents nodes from spreading too far apart on the initial render
      graphRef.current.d3Force("charge")?.distanceMax(250);
      //It prevents the circular layout when there are many child nodes
      graphRef.current.d3Force("link")?.distance(() => Math.floor(Math.random() * (130 - 70 + 1)) + 70);
    }
  }, [data]);

  return (
    <Flex direction="column" style={{ height: "85vh" }}>
      <Box ref={ref} style={{ flex: 1, position: "relative" }}>
        {!isFetching && data && (
          <ForceGraph2D
            ref={graphRef}
            graphData={data}
            width={width}
            height={height}
            backgroundColor={`var(--mantine-color-body)`}
            linkColor={getLinkColor}
            linkCurvature={(link: LinkObject<IGraphDataNode, IGraphDataLink>) => link.curvature || 0}
            linkDirectionalArrowLength={GRAPH_CONFIG.link.arrowLength}
            linkDirectionalArrowRelPos={getLinkDirectionalArrowRelPos}
            linkDirectionalParticles={getLinkParticles}
            linkDirectionalParticleWidth={getLinkParticleWidth}
            linkWidth={getLinkWidth}
            linkDirectionalParticleSpeed={GRAPH_CONFIG.link.particle.speed}
            nodeCanvasObject={paint}
            nodePointerAreaPaint={nodePointerAreaPaint}
            nodeVal={1}
            onNodeHover={handleNodeHover}
            onLinkHover={handleLinkHover}
            onNodeClick={handleNodeClick}
            cooldownTicks={1000}
          />
        )}
      </Box>
    </Flex>
  );
}