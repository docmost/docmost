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

export default function Graph({ space }) {
  const navigate = useNavigate();
  const computedColorScheme = useComputedColorScheme();
  const { ref, width, height } = useElementSize();
  const graphRef = useRef<any>();
  const { data: graphData, isLoading, isFetching, isError, refetch } = useGetSpaceGraph(space.id);

  const [data, setData] = useState<GraphData<IGraphDataNode, IGraphDataLink>>();

  const [highlightNodes, setHighlightNodes] = useState<Set<IGraphDataNode>>(
    new Set()
  );
  const [highlightLinks, setHighlightLinks] = useState<Set<IGraphDataLink>>(
    new Set()
  );
  const [hoverNode, setHoverNode] = useState<IGraphDataNode | null>(null);

  useEffect(() => {
    // we need to force refatch
    setData(null);
    refetch()
  },[])

  const graphConfig = {
    label: {
      size: 14,
      strokeSize: 1,
      paddingX: 0,
      paddingY: 8,
    },
    node: {
      size: 5,
      border: 2,
    },
    link: {
      width: 2,
      highlightWidth: 4,
      arrowLength: 6,
      particle: {
        number: 1,
        highlightNumber: 2,
        width: 3,
        highlightWidth: 4,
        speed: 0.01,
      },
    },
    colors: {
      light: {
        parent: "#0152A2",
        backlink: "#8A0000",
        parentNotHighlight: "#7F93A7",
        backlinkNotHighlight: "#987777",
        node: "#244561",
        nodeBorder: "#b3cde6",
        nodeBorderHover: "#DA0000",
        nodeBorderHighlight: "#F78844",
        nodeNotHighlight: "#9C9D9F",
        nodeBorderNotHighlight: "#CECECE",
        text: "#495057",
        textBorder: "#FFFFFF",
      },
      dark: {
        parent: "#74B8FC",
        backlink: "#FF7575",
        parentNotHighlight: "#708FAE",
        backlinkNotHighlight: "#A27676",
        node: "#b3cde6",
        nodeBorder: "#244561",
        nodeBorderHover: "#DA0000",
        nodeBorderHighlight: "#F78844",
        nodeNotHighlight: "#9C9D9F",
        nodeBorderNotHighlight: "#CECECE",
        text: "#c9c9c9",
        textBorder: "#242424",
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
          const spread = 0.4;
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

  useEffect(() => {
    if (graphData && !isFetching) {
      const links: LinkObject<IGraphDataNode, IGraphDataLink>[] = [
        ...graphData
          .filter((page) => page.parentPageId !== null)
          .map((page) => ({
            source: page.parentPageId,
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
      graphData.map((page) =>
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
          sourceNode.neighbors.add(targetNode);
          sourceNode.links.add(link);
          targetNode.neighbors.add(sourceNode);
          targetNode.links.add(link);
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
      graphRef.current.d3Force('charge')?.strength(-50);
      graphRef.current.d3Force('link')?.distance(80);
      setTimeout(() => {
        graphRef.current.zoomToFit(400, 100);
      }, 2000);
    }
  }, [data]);

  const handleNodeHover = (node: NodeObject<IGraphDataNode>) => {
    const newHighlightNodes = new Set<IGraphDataNode>();
    const newHighlightLinks = new Set<IGraphDataLink>();
    if (node) {
      newHighlightNodes.add(node);
      node.neighbors.forEach((neighbor) => newHighlightNodes.add(neighbor));
      node.links.forEach((link) => newHighlightLinks.add(link));
    }

    setHoverNode(node || null);
    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
  };

  const handleLinkHover = (
    link: LinkObject<IGraphDataNode, IGraphDataLink>
  ) => {
    const newHighlightNodes = new Set<NodeObject<IGraphDataNode>>();
    const newHighlightLinks = new Set<
      LinkObject<IGraphDataNode, IGraphDataLink>
    >();
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
      const label = node.title;
      const fontSize = graphConfig.label.size / globalScale;

      ctx.beginPath();

      ctx.arc(
        node.x,
        node.y,
        graphConfig.node.size + graphConfig.node.border,
        0,
        2 * Math.PI,
        false
      );
      if (node === hoverNode) {
        ctx.fillStyle = graphConfig.colors[computedColorScheme].nodeBorderHover;
      } else if (highlightNodes.has(node)) {
        ctx.fillStyle =
          graphConfig.colors[computedColorScheme].nodeBorderHighlight;
      } else if (highlightLinks.size > 0 && !highlightNodes.has(node)) {
        ctx.fillStyle =
          graphConfig.colors[computedColorScheme].nodeBorderNotHighlight;
      } else {
        ctx.fillStyle = graphConfig.colors[computedColorScheme].nodeBorder;
      }
      ctx.fill();

      ctx.beginPath();
      ctx.arc(node.x, node.y, graphConfig.node.size, 0, 2 * Math.PI, false);
      ctx.fillStyle = graphConfig.colors[computedColorScheme].node;
      if (highlightLinks.size > 0 && !highlightNodes.has(node)) {
        ctx.fillStyle =
          graphConfig.colors[computedColorScheme].nodeNotHighlight;
      }
      ctx.fill();

      // label
      ctx.font = `bold ${fontSize}px Sans-Serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      ctx.strokeStyle = graphConfig.colors[computedColorScheme].textBorder;
      ctx.lineWidth = graphConfig.label.strokeSize / globalScale;

      ctx.strokeText(
        label,
        node.x + graphConfig.label.paddingX,
        node.y + graphConfig.label.paddingY
      );

      ctx.fillStyle = graphConfig.colors[computedColorScheme].text;
      ctx.fillText(
        label,
        node.x + graphConfig.label.paddingX,
        node.y + graphConfig.label.paddingY
      );
    },
    [hoverNode, highlightNodes]
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
            linkColor={(link) => {
              if (highlightLinks.size > 0 && !highlightLinks.has(link)) {
                if (link.type === "backlink")
                  return graphConfig.colors[computedColorScheme]
                    .backlinkNotHighlight;
                if (link.type === "parent")
                  return graphConfig.colors[computedColorScheme]
                    .parentNotHighlight;
              }

              if (link.type === "backlink")
                return graphConfig.colors[computedColorScheme].backlink;
              if (link.type === "parent")
                return graphConfig.colors[computedColorScheme].parent;
            }}
            linkCurvature={(link) => link.curvature || 0}
            linkDirectionalArrowLength={graphConfig.link.arrowLength}
            linkDirectionalArrowRelPos={1}
            linkDirectionalParticles={(link) =>
              highlightLinks.has(link)
                ? graphConfig.link.particle.highlightNumber
                : graphConfig.link.particle.number
            }
            linkDirectionalParticleWidth={(link) =>
              highlightLinks.has(link)
                ? graphConfig.link.particle.highlightWidth
                : graphConfig.link.particle.width
            }
            linkWidth={(link) =>
              highlightLinks.has(link)
                ? graphConfig.link.highlightWidth
                : graphConfig.link.width
            }
            linkDirectionalParticleSpeed={graphConfig.link.particle.speed}
            nodeCanvasObject={paint}
            nodeRelSize={graphConfig.node.size + graphConfig.node.border}
            onNodeHover={handleNodeHover}
            onLinkHover={handleLinkHover}
            onNodeClick={(node, event) => {
              navigate(buildPageUrl(space.slug, node.slugId, node.title));
            }}
            cooldownTicks={1000}
          />
        )}
      </Box>
    </Flex>
  );
}
