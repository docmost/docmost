import { Flex, Box, useComputedColorScheme } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useCallback, useEffect, useRef, useState } from "react";
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
    baseSize: 10,
    maxSize: 14,
    strokeSize: 0.8,
    paddingX: 0,
    paddingY: 6,
  },
  node: {
    minSize: 3,
    maxSize: 8,
    baseBorder: 1.2,
    maxBorder: 2,
  },
  link: {
    width: 1,
    highlightWidth: 2,
    arrowLength: 4,
    opacity: 0.3,
    highlightOpacity: 0.8,
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
      parent: "rgba(1, 82, 162, 0.4)",
      backlink: "rgba(138, 0, 0, 0.4)",
      parentNotHighlight: "rgba(127, 147, 167, 0.2)",
      backlinkNotHighlight: "rgba(152, 119, 119, 0.2)",
      node: "#244561",
      nodeBorder: "#b3cde6",
      nodeBorderHover: "#DA0000",
      nodeBorderHighlight: "#F78844",
      nodeNotHighlight: "#9C9D9F",
      nodeBorderNotHighlight: "#CECECE",
      text: "#495057",
      textBorder: "rgba(255, 255, 255, 0.8)",
    },
    dark: {
      parent: "rgba(116, 184, 252, 0.5)",
      backlink: "rgba(255, 117, 117, 0.5)",
      parentNotHighlight: "rgba(112, 143, 174, 0.25)",
      backlinkNotHighlight: "rgba(162, 118, 118, 0.25)",
      node: "#b3cde6",
      nodeBorder: "#244561",
      nodeBorderHover: "#DA0000",
      nodeBorderHighlight: "#F78844",
      nodeNotHighlight: "#9C9D9F",
      nodeBorderNotHighlight: "#CECECE",
      text: "#c9c9c9",
      textBorder: "rgba(36, 36, 36, 0.8)",
    },
  },
};

function assignCurvature(
  links: LinkObject<IGraphDataNode, IGraphDataLink>[]
): LinkObject<IGraphDataNode, IGraphDataLink>[] {
  const groupedLinks = {};

  links.forEach((link) => {
    const key = `${link.source}|${link.target}`;
    if (!groupedLinks[key]) groupedLinks[key] = [];
    groupedLinks[key].push(link);
  });

  Object.values(groupedLinks).forEach(
    (group: LinkObject<IGraphDataNode, IGraphDataLink>[]) => {
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

function getLinkColor(
  link: LinkObject<IGraphDataNode, IGraphDataLink>,
  highlightLinks: Set<LinkObject<IGraphDataNode, IGraphDataLink>>,
  hoverNode: NodeObject<IGraphDataNode> | null,
  colorScheme: string
) {
  const colors = GRAPH_CONFIG.colors[colorScheme];
  const isHighlighted = highlightLinks.has(link);
  const shouldDim =
    (highlightLinks.size > 0 && !isHighlighted) ||
    (highlightLinks.size === 0 && hoverNode);

  if (link.type === "backlink") {
    return shouldDim ? colors.backlinkNotHighlight : colors.backlink;
  }
  return shouldDim ? colors.parentNotHighlight : colors.parent;
}

function getNodeColors(
  node: NodeObject<IGraphDataNode>,
  hoverNode: NodeObject<IGraphDataNode> | null,
  highlightNodes: Set<NodeObject<IGraphDataNode>>,
  colorScheme: string
) {
  const colors = GRAPH_CONFIG.colors[colorScheme];
  const isHovered = node === hoverNode;
  const isHighlighted = highlightNodes.has(node);
  const shouldDim =
    (highlightNodes.size === 1 && hoverNode && !isHighlighted) ||
    (highlightNodes.size > 0 && !isHighlighted);

  let borderColor = colors.nodeBorder;
  let fillColor = colors.node;

  if (isHovered) {
    borderColor = colors.nodeBorderHover;
  } else if (isHighlighted) {
    borderColor = colors.nodeBorderHighlight;
  } else if (shouldDim) {
    borderColor = colors.nodeBorderNotHighlight;
    fillColor = colors.nodeNotHighlight;
  }

  return { borderColor, fillColor };
}

function getNodeSize(node: NodeObject<IGraphDataNode>, maxConnections: number, minConnections: number) {
  const connectionCount = node.neighbors?.size || 0;
  const normalizedSize = maxConnections > minConnections
    ? (connectionCount - minConnections) / (maxConnections - minConnections)
    : 0.5;

  const nodeSize = GRAPH_CONFIG.node.minSize +
    (GRAPH_CONFIG.node.maxSize - GRAPH_CONFIG.node.minSize) * normalizedSize;

  const borderSize = GRAPH_CONFIG.node.baseBorder +
    (GRAPH_CONFIG.node.maxBorder - GRAPH_CONFIG.node.baseBorder) * normalizedSize;

  const labelSize = GRAPH_CONFIG.label.baseSize +
    (GRAPH_CONFIG.label.maxSize - GRAPH_CONFIG.label.baseSize) * normalizedSize * 0.5;

  return { nodeSize, borderSize, labelSize };
}

function drawNode(
  node: NodeObject<IGraphDataNode>,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  hoverNode: NodeObject<IGraphDataNode> | null,
  highlightNodes: Set<NodeObject<IGraphDataNode>>,
  colorScheme: string,
  maxConnections: number,
  minConnections: number
) {
  const { borderColor, fillColor } = getNodeColors(
    node,
    hoverNode,
    highlightNodes,
    colorScheme
  );
  const { nodeSize, borderSize, labelSize } = getNodeSize(node, maxConnections, minConnections);
  const colors = GRAPH_CONFIG.colors[colorScheme];

  // Draw border
  ctx.beginPath();
  ctx.arc(
    node.x!,
    node.y!,
    nodeSize + borderSize,
    0,
    2 * Math.PI,
    false
  );
  ctx.fillStyle = borderColor;
  ctx.fill();

  // Draw node
  ctx.beginPath();
  ctx.arc(node.x!, node.y!, nodeSize, 0, 2 * Math.PI, false);
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Draw label
  const fontSize = labelSize / globalScale;
  ctx.font = `${fontSize}px Sans-Serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Text border
  ctx.strokeStyle = colors.textBorder;
  ctx.lineWidth = GRAPH_CONFIG.label.strokeSize / globalScale;
  ctx.strokeText(
    node.title!,
    node.x! + GRAPH_CONFIG.label.paddingX,
    node.y! + nodeSize + borderSize + GRAPH_CONFIG.label.paddingY
  );

  // Text fill
  ctx.fillStyle = colors.text;
  ctx.fillText(
    node.title!,
    node.x! + GRAPH_CONFIG.label.paddingX,
    node.y! + nodeSize + borderSize + GRAPH_CONFIG.label.paddingY
  );
}

export default function Graph({ space }) {
  const navigate = useNavigate();
  const computedColorScheme = useComputedColorScheme();
  const { ref, width, height } = useElementSize();
  const graphRef = useRef<any>();
  const {
    data: graphData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetSpaceGraph(space.id);

  const [data, setData] = useState<
    GraphData<IGraphDataNode, IGraphDataLink>
  >();
  const [highlightNodes, setHighlightNodes] = useState<
    Set<NodeObject<IGraphDataNode>>
  >(new Set());
  const [highlightLinks, setHighlightLinks] = useState<
    Set<LinkObject<IGraphDataNode, IGraphDataLink>>
  >(new Set());
  const [hoverNode, setHoverNode] = useState<NodeObject<IGraphDataNode> | null>(null);
  const [maxConnections, setMaxConnections] = useState(1);
  const [minConnections, setMinConnections] = useState(0);

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

      // Calculate connection statistics
      const connectionCounts = Array.from(nodeMap.values()).map(node => node.neighbors?.size || 0);
      const maxConn = Math.max(...connectionCounts, 1);
      const minConn = Math.min(...connectionCounts, 0);

      setMaxConnections(maxConn);
      setMinConnections(minConn);

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
      graphRef.current.d3Force("link")?.distance(70);
      setTimeout(() => {
        graphRef.current.zoomToFit(400, 100);
      }, 2000);
    }
  }, [data]);

  const handleNodeHover = (
    node: NodeObject<IGraphDataNode> | null,
    previousNode: NodeObject<IGraphDataNode> | null
  ) => {
    const newHighlightNodes = new Set<NodeObject<IGraphDataNode>>();
    const newHighlightLinks = new Set<LinkObject<IGraphDataNode, IGraphDataLink>>();

    if (node) {
      newHighlightNodes.add(node);
      node.neighbors?.forEach((neighbor) => newHighlightNodes.add(neighbor));
      node.links?.forEach((link) => newHighlightLinks.add(link));
    }

    setHoverNode(node);
    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
  };

  const handleLinkHover = (
    link: LinkObject<IGraphDataNode, IGraphDataLink> | null
  ) => {
    const newHighlightNodes = new Set<NodeObject<IGraphDataNode>>();
    const newHighlightLinks = new Set<LinkObject<IGraphDataNode, IGraphDataLink>>();

    if (link) {
      newHighlightLinks.add(link);
      newHighlightNodes.add(link.source as NodeObject<IGraphDataNode>);
      newHighlightNodes.add(link.target as NodeObject<IGraphDataNode>);
    }
    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
  };

  const paint = useCallback(
    (
      node: NodeObject<IGraphDataNode>,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      drawNode(
        node,
        ctx,
        globalScale,
        hoverNode,
        highlightNodes,
        computedColorScheme,
        maxConnections,
        minConnections
      );
    },
    [hoverNode, highlightNodes, computedColorScheme, maxConnections, minConnections]
  );

  return (
    <Flex direction="column" style={{ height: "85vh" }}>
      <Box ref={ref} style={{ flex: 1, position: "relative" }}>
        {!isFetching && data && (
          <ForceGraph2D
            ref={graphRef}
            graphData={data}
            width={width}
            height={height}
            linkColor={(link) =>
              getLinkColor(link, highlightLinks, hoverNode, computedColorScheme)
            }
            linkCurvature={(link) => link.curvature || 0}
            linkDirectionalArrowLength={GRAPH_CONFIG.link.arrowLength}
            linkDirectionalArrowRelPos={1}
            linkDirectionalParticles={(link) =>
              highlightLinks.has(link)
                ? GRAPH_CONFIG.link.particle.highlightNumber
                : GRAPH_CONFIG.link.particle.number
            }
            linkDirectionalParticleWidth={(link) =>
              highlightLinks.has(link)
                ? GRAPH_CONFIG.link.particle.highlightWidth
                : GRAPH_CONFIG.link.particle.width
            }
            linkWidth={(link) =>
              highlightLinks.has(link)
                ? GRAPH_CONFIG.link.highlightWidth
                : GRAPH_CONFIG.link.width
            }
            linkDirectionalParticleSpeed={GRAPH_CONFIG.link.particle.speed}
            nodeCanvasObject={paint}
            nodeVal={1}
            onNodeHover={handleNodeHover}
            onLinkHover={handleLinkHover}
            onNodeClick={(node, event) => {
              if (node) {
                navigate(buildPageUrl(space.slug, node.slugId!, node.title!));
              }
            }}
            cooldownTicks={1000}
          />
        )}
      </Box>
    </Flex>
  );
}