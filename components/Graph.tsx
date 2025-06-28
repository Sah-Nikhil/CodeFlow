// components/Graph.tsx
"use client";

import React, { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import { Node, Edge } from "@/lib/parser/babel";

interface GraphProps {
  graphData: {
    nodes: Node[];
    edges: Edge[];
  };
  width: number;
  height: number;
  onNodeClick?: (node: Node) => void;
}

// Extend D3's SimulationNodeDatum to include our Node properties
interface D3Node extends d3.SimulationNodeDatum, Node {}
interface D3Edge extends d3.SimulationLinkDatum<D3Node>, Edge {}

const Graph: React.FC<GraphProps> = ({
  graphData,
  width,
  height,
  onNodeClick,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null); // Ref for the main group element to apply zoom/pan later

  // Store simulation in a ref to persist across renders and for drag handlers
  const simulationRef = useRef<d3.Simulation<D3Node, D3Edge>>();

  // Use useCallback to memoize drag event handlers
  const dragstarted = useCallback(
    (event: d3.D3DragEvent<any, D3Node, any>) => {
      if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    },
    []
  );

  const dragged = useCallback((event: d3.D3DragEvent<any, D3Node, any>) => {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }, []);

  const dragended = useCallback(
    (event: d3.D3DragEvent<any, D3Node, any>) => {
      if (!event.active) simulationRef.current?.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    },
    []
  );

  useEffect(() => {
    // Basic validation for dimensions and data
    if (!svgRef.current || width <= 0 || height <= 0 || !graphData || !graphData.nodes || !graphData.edges) {
      console.log("Graph: Skipping render due to invalid dimensions or missing data.", { width, height, graphData });
      return;
    }

    const svg = d3.select(svgRef.current);

    // Initialize the main group 'g' element only once for drawing
    // This allows us to keep appending elements without clearing the whole SVG
    if (!gRef.current) {
        gRef.current = svg.append("g").node() as SVGGElement;
    }
    const g = d3.select(gRef.current);

    // Clear elements within the group to redraw cleanly when data changes
    g.selectAll("*").remove();


    // Map data to D3 format. Ensure deep copy or new objects if graphData mutates.
    const nodesData: D3Node[] = graphData.nodes.map((node) => ({
      ...node,
      // Maintain x/y if simulation already ran, otherwise D3 will initialize
      x: node.x || node.position?.x,
      y: node.y || node.position?.y,
      vx: node.vx || 0, // Ensure velocity is reset or preserved
      vy: node.vy || 0,
    }));
    const edgesData: D3Edge[] = graphData.edges.map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
    }));

    // --- Initialize/Update Simulation ---
    if (!simulationRef.current) {
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
        .force("collide", d3.forceCollide(20)) // Prevent node overlap
        .on("tick", ticked);
    } else {
      // Update simulation nodes and links with new data
      simulationRef.current.nodes(nodesData);
      (simulationRef.current.force("link") as d3.ForceLink<D3Node, D3Edge>).links(edgesData);
      simulationRef.current.alpha(1).restart(); // Restart simulation vigorously
    }

    // --- Define Arrowhead Marker ---
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 13) // Start arrow slightly outside node radius (7) + stroke (1.5) + buffer
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 10)
      .attr("markerHeight", 10)
      .attr("xoverflow", "visible")
      .append("path")
      .attr("d", "M 0,-5 L 10,0 L 0,5")
      .attr("fill", "#999")
      .style("stroke", "none");

    // --- Create Links (Edges) ---
    const link = g
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(edgesData, (d: D3Edge) => d.id) // Use data join key for efficient updates
      .join("line")
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrowhead)");

    // --- Create Nodes (Groups for circle + text) ---
    const nodeGroup = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodesData, (d: D3Node) => d.id) // Use data join key
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

    // Append circle to nodeGroup
    nodeGroup
      .append("circle")
      .attr("r", 7)
      .attr("fill", (d) => {
        switch (d.data.type) {
          case "file":
            return "#69b3a2"; // Teal
          case "function":
            return "#4285F4"; // Google Blue
          case "class":
            return "#DB4437"; // Google Red
          case "component":
            return "#F4B400"; // Google Yellow
          case "export":
            return "#0F9D58"; // Google Green
          case "import":
            return "#9e5fba"; // Purple
          default:
            return "#ccc"; // Grey
        }
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    // Append text to nodeGroup
    nodeGroup
      .append("text")
      .attr("dx", 10)
      .attr("dy", 4)
      .attr("font-size", "10px")
      .attr("fill", "#333")
      .attr("pointer-events", "none") // Ensures drag works on the group, not text
      .text((d) => {
        return d.data.type === "file" && d.data.label.includes("/")
          ? d.data.label.split("/").pop()!
          : d.data.label;
      });

    // Append tooltip title
    nodeGroup.append("title").text((d) => d.id);

    // --- Tick Function (updates positions) ---
    function ticked() {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    }

    // Clean up simulation on component unmount
    return () => {
      simulationRef.current?.stop();
      // Optionally, remove all children from 'g' when unmounting too
      if (gRef.current) {
        d3.select(gRef.current).selectAll("*").remove();
        gRef.current = null; // Reset the ref
      }
    };

  }, [graphData, width, height, dragstarted, dragged, dragended]); // Dependencies

  return (
    <div
      className="relative w-full h-full"
      style={{ minHeight: height, minWidth: width }}
    >
      <svg ref={svgRef} width={width} height={height}>
        {/* The D3 elements will be appended here via the 'gRef' */}
      </svg>
    </div>
  );
};

export default Graph;
