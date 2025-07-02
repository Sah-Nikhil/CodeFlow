// components/Graph.tsx (full updated version with zoom/pan)
"use client";

import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import * as d3 from "d3";
import { Node, Edge } from "@/lib/parsers/babel";

interface GraphProps {
  graphData: {
    nodes: Node[];
    edges: Edge[];
  };
  width: number;
  height: number;
  onNodeClick?: (node: Node) => void;
}

interface D3Node extends d3.SimulationNodeDatum, Node {}
interface D3Edge extends d3.SimulationLinkDatum<D3Node>, Edge {}

const Graph = forwardRef<
  { focusNode: (nodeId: string) => void },
  GraphProps
>(({ graphData, width, height, onNodeClick }, ref) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Removed gRef for now to simplify debugging

  const simulationRef = useRef<d3.Simulation<D3Node, D3Edge> | undefined>(undefined);
  // Store the current zoom transform
  const zoomTransformRef = useRef<d3.ZoomTransform | null>(null);
  const zoomGroupRef = useRef<SVGGElement | null>(null);
  const d3ZoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodesDataRef = useRef<D3Node[]>([]);

  const dragstarted = useCallback(
    (event: d3.D3DragEvent<any, D3Node, any>) => {
      console.log("Drag started", event.subject.id);
      if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    },
    []
  );

  const dragged = useCallback((event: d3.D3DragEvent<any, D3Node, any>) => {
    // Use event.x and event.y directly for dragging (they are in the correct zoomed coordinates)
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }, []);

  const dragended = useCallback(
    (event: d3.D3DragEvent<any, D3Node, any>) => {
      console.log("Drag ended", event.subject.id);
      if (!event.active) simulationRef.current?.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    },
    []
  );

  useEffect(() => {
    console.log("Graph useEffect called with dimensions:", { width, height, nodes: graphData?.nodes?.length });

    if (!svgRef.current || width <= 0 || height <= 0 || !graphData || !graphData.nodes || !graphData.edges) {
      console.warn("Graph: Skipping D3 setup due to invalid input.");
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // --- Add Zoom/Pan Support ---
    const zoomGroup = svg.append("g").attr("class", "zoom-group");
    zoomGroupRef.current = zoomGroup.node();
    d3ZoomRef.current = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        zoomGroup.attr("transform", event.transform);
        zoomTransformRef.current = event.transform;
      });
    svg.call(d3ZoomRef.current);

    // Ensure data is mapped correctly for D3
    const nodesData: D3Node[] = graphData.nodes.map((node) => ({
      ...node,
      // D3 will initialize x/y if undefined. We don't want to fix them at (0,0) here.
      x: (node as any).x ?? undefined,
      y: (node as any).y ?? undefined,
      vx: (node as any).vx ?? 0,
      vy: (node as any).vy ?? 0,
    }));
    nodesDataRef.current = nodesData;
    const edgesData: D3Edge[] = graphData.edges.map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
    }));

    console.log("Nodes Data for D3:", nodesData.length, nodesData);
    console.log("Edges Data for D3:", edgesData.length, edgesData);


    // --- Initialize/Update Simulation ---
    // Always create a new simulation if width/height changes or ref is null
    // This is safer than trying to update an existing one when debugging persistence
    simulationRef.current = d3
        .forceSimulation<D3Node, D3Edge>(nodesData)
        .force(
          "link",
          d3
            .forceLink<D3Node, D3Edge>(edgesData)
            .id((d) => d.id)
            .distance(150)
            .strength(0.7)
        )
        .force("charge", d3.forceManyBody().strength(-800))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide(20))
        .on("tick", ticked);

    // Initial alpha for immediate restart
    simulationRef.current.alpha(1).restart();
    console.log("D3 Simulation initialized/restarted.");


    // --- Create SVG Elements ---
    // Ensure defs and marker are recreated each time with selectAll("*").remove()
    zoomGroup
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 13)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 10)
      .attr("markerHeight", 10)
      .attr("xoverflow", "visible")
      .append("path")
      .attr("d", "M 0,-5 L 10,0 L 0,5")
      .attr("fill", "#999")
      .style("stroke", "none");

    const link = zoomGroup
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll<SVGLineElement, D3Edge>("line")
      .data(edgesData, (d) => d.id)
      .join("line")
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrowhead)");

    const nodeGroup = zoomGroup
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, D3Node>("g")
      .data(nodesData, (d) => d.id)
      .join("g")
      .call(
        d3
          .drag<SVGGElement, D3Node>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      )
      .on("click", (event, d) => onNodeClick && onNodeClick(d))
      .attr("cursor", "pointer");

    nodeGroup
      .append("circle")
      .attr("r", 7)
      .attr("fill", (d) => {
        switch (d.data.type) {
          case "file": return "#69b3a2";
          case "function": return "#4285F4";
          case "class": return "#DB4437";
          case "component": return "#F4B400";
          case "export": return "#0F9D58";
          case "import": return "#9e5fba";
          default: return "#ccc";
        }
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    nodeGroup
      .append("text")
      .attr("dx", 10)
      .attr("dy", 4)
      .attr("font-size", "10px")
      .attr("fill", "#333")
      .attr("pointer-events", "none")
      .text((d) => {
        return d.data.type === "file" && d.data.label.includes("/")
          ? d.data.label.split("/").pop()!
          : d.data.label;
      });

    nodeGroup.append("title").text((d) => d.id);

    // --- Tick Function (updates positions) ---
    function ticked() {
        // Remove clamping: allow nodes to move freely (zoom/pan will keep them visible)
        link
            .attr("x1", (d: any) => d.source.x)
            .attr("y1", (d: any) => d.source.y)
            .attr("x2", (d: any) => d.target.x)
            .attr("y2", (d: any) => d.target.y);

        nodeGroup.attr("transform", (d: any) => {
            if (isNaN(d.x) || isNaN(d.y)) {
                console.error("NaN coordinates for node:", d.id, d.x, d.y);
                return `translate(0,0)`; // Fallback
            }
            return `translate(${d.x},${d.y})`;
        });
        // Log a few node positions to see if they are changing
        if (nodesData.length > 0 && Math.random() < 0.01) { // Log occasionally to avoid spam
            console.log(`Tick update: node[0] x=${nodesData[0].x}, y=${nodesData[0].y}`);
        }
    }

    // Cleanup simulation on component unmount
    return () => {
      console.log("Graph useEffect cleanup.");
      simulationRef.current?.stop();
    };

  }, [graphData, width, height, dragstarted, dragged, dragended]);

  // --- Imperative handle for focusing/zooming to a node ---
  useImperativeHandle(ref, () => ({
    focusNode: (nodeId: string) => {
      if (!svgRef.current || !zoomGroupRef.current || !d3ZoomRef.current) return;
      const node = nodesDataRef.current.find((n) => n.id === nodeId);
      console.log('[Graph] focusNode called with nodeId:', nodeId);
      if (!node) {
        console.warn('[Graph] No node found for id:', nodeId, 'Available node ids:', nodesDataRef.current.map(n => n.id));
        return;
      }
      if (typeof node.x !== "number" || typeof node.y !== "number") {
        console.warn('[Graph] Node found but x/y not set:', nodeId, node);
        return;
      }
      const svg = d3.select(svgRef.current);
      const svgWidth = svgRef.current.width.baseVal.value;
      const svgHeight = svgRef.current.height.baseVal.value;
      const scale = 1.5;
      const tx = svgWidth / 2 - node.x * scale;
      const ty = svgHeight / 2 - node.y * scale;
      svg.transition()
        .duration(600)
        .call(d3ZoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      console.log('[Graph] Focused on node:', nodeId, 'at', node.x, node.y);
    }
  }), []);

  return (
    <div
      className="relative w-full h-full"
      style={{ minHeight: height, minWidth: width }}
    >
      <svg ref={svgRef} width={width} height={height}></svg>
    </div>
  );
});

export default Graph;
