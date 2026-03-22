import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useUser } from '../../store/useAppStore';
import { useLiveStats } from '../../hooks/useRealtimeSync';

export default function KnowledgeGraph() {
  const user = useUser();
  const { stats, loading } = useLiveStats(user?.id);
  
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  
  const [highlightedSubject, setHighlightedSubject] = useState(null);
  
  const simulationRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);

  useEffect(() => {
    if (loading || !stats?.weakTopics || stats.weakTopics.length === 0) return;

    const rawData = stats.weakTopics;
    const newNodes = [];
    const newLinks = [];
    
    // Group subjects
    const subjects = [...new Set(rawData.map(d => d.subject))];
    
    subjects.forEach((subj) => {
      newNodes.push({
        id: `subj_${subj}`,
        label: subj,
        isSubject: true,
        radius: 36
      });
    });
    
    const colors = { weak: '#ef4444', learning: '#f59e0b', strong: '#22c55e' };
    
    rawData.forEach((topic) => {
      const acc = parseFloat(topic.accuracy);
      let color = colors.strong;
      if (acc < 40) color = colors.weak;
      else if (acc <= 70) color = colors.learning;
      
      const att = parseInt(topic.attempts_count, 10) || 1;
      const radiusScale = d3.scaleLinear().domain([1, 50]).range([8, 28]).clamp(true);
      const r = radiusScale(att);

      newNodes.push({
        id: `topic_${topic.subject}_${topic.topic}`,
        label: topic.topic,
        subject: topic.subject,
        isSubject: false,
        radius: r,
        color: color,
        accuracy: acc,
        attempts: att
      });
      
      newLinks.push({
        source: `topic_${topic.subject}_${topic.topic}`,
        target: `subj_${topic.subject}`
      });
    });
    
    const width = containerRef.current?.clientWidth || 800;
    const height = 420;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    // Graph Groups
    let linkGroup = svg.select(".links");
    if (linkGroup.empty()) linkGroup = svg.append("g").attr("class", "links");
    
    let nodeGroup = svg.select(".nodes");
    if (nodeGroup.empty()) nodeGroup = svg.append("g").attr("class", "nodes");
    
    let tooltipGroup = svg.select(".tooltip-group");
    if (tooltipGroup.empty()) {
       tooltipGroup = svg.append("g")
         .attr("class", "tooltip-group")
         .attr("pointer-events", "none")
         .style("opacity", 0);
         
       tooltipGroup.append("rect")
         .attr("class", "tooltip-bg")
         .attr("rx", 6)
         .attr("ry", 6)
         .attr("fill", "rgba(255, 255, 255, 0.95)")
         .attr("stroke", "#e2e8f0");
         
       tooltipGroup.append("text")
         .attr("class", "tooltip-title")
         .attr("font-size", "14px")
         .attr("font-weight", "bold")
         .attr("fill", "#1e293b")
         .attr("y", 16)
         .attr("x", 12);
         
       tooltipGroup.append("text")
         .attr("class", "tooltip-subtitle")
         .attr("font-size", "12px")
         .attr("fill", "#64748b")
         .attr("y", 34)
         .attr("x", 12);
    }

    const oldNodes = new Map(nodesRef.current.map(d => [d.id, d]));
    
    const mappedNodes = newNodes.map(d => {
      const old = oldNodes.get(d.id);
      if (old) {
        return { ...d, x: old.x, y: old.y, vx: old.vx, vy: old.vy };
      }
      return d;
    });

    const mappedLinks = newLinks.map(d => ({ ...d }));

    nodesRef.current = mappedNodes;
    linksRef.current = mappedLinks;

    if (!simulationRef.current) {
      simulationRef.current = d3.forceSimulation(mappedNodes)
        .force("link", d3.forceLink(mappedLinks).id(d => d.id).distance(80))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => d.radius + 5).iterations(2));
    } else {
      simulationRef.current.nodes(mappedNodes);
      simulationRef.current.force("link").links(mappedLinks);
      simulationRef.current.alpha(0.3).restart();
    }
    
    // Links Processing
    let link = linkGroup.selectAll("line").data(mappedLinks, d => `${typeof d.source === 'object' ? d.source.id : d.source}-${typeof d.target === 'object' ? d.target.id : d.target}`);
    link.exit().remove();
    const linkEnter = link.enter().append("line")
      .attr("stroke", "#9ca3af")
      .attr("stroke-opacity", 0.3)
      .attr("stroke-width", 2);
    link = linkEnter.merge(link);

    // Nodes Processing
    const drag = (simulation) => d3.drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    let node = nodeGroup.selectAll("g.node").data(mappedNodes, d => d.id);
    node.exit().transition().duration(800).attr("opacity", 0).remove();
    
    const nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .call(drag(simulationRef.current));
      
    // Circle Appending
    nodeEnter.append("circle")
      .attr("r", 0)
      .attr("fill", d => d.isSubject ? "#6366f1" : d.color)
      .attr("stroke", d => d.isSubject ? "#4f46e5" : "#1e293b")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("click", (evt, d) => {
        evt.stopPropagation();
        if (d.isSubject) {
          setHighlightedSubject(prev => prev === d.label ? null : d.label);
        }
      })
      .on("pointerenter", (evt, d) => {
        if (!d.isSubject) {
          tooltipGroup.transition().duration(200).style("opacity", 1);
          tooltipGroup.select(".tooltip-title").text(d.label);
          tooltipGroup.select(".tooltip-subtitle").text(`Acc: ${Math.round(d.accuracy)}% | Attempts: ${d.attempts}`);
          
          const padding = 24;
          const bg = tooltipGroup.select(".tooltip-bg");
          const titleWidth = tooltipGroup.select(".tooltip-title").node().getBBox().width;
          const subWidth = tooltipGroup.select(".tooltip-subtitle").node().getBBox().width;
          const rectWidth = Math.max(titleWidth, subWidth) + padding;
          
          bg.attr("width", rectWidth).attr("height", 46);
        }
      })
      .on("pointerleave", () => {
        tooltipGroup.transition().duration(200).style("opacity", 0);
      });

    // Subject Label Appending
    nodeEnter.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", ".3em")
      .attr("fill", "#ffffff")
      .attr("font-weight", "bold")
      .attr("font-size", "13px")
      .attr("pointer-events", "none")
      .text(d => d.isSubject ? d.label : "");

    node = nodeEnter.merge(node);
    
    // Live Smooth Update Transitions
    node.select("circle").transition().duration(800)
      .attr("r", d => d.radius)
      .attr("fill", d => d.isSubject ? "#6366f1" : d.color);

    simulationRef.current.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
      
      if (tooltipGroup.style("opacity") > 0) {
        const hoveredLabel = tooltipGroup.select(".tooltip-title").text();
        const hoveredNodeData = node.data().find(n => n.label === hoveredLabel && !n.isSubject);
        if (hoveredNodeData) {
            const tw = tooltipGroup.select(".tooltip-bg").attr("width");
            tooltipGroup.attr("transform", `translate(${hoveredNodeData.x - tw/2},${hoveredNodeData.y - hoveredNodeData.radius - 55})`);
        }
      }
    });

  }, [stats?.weakTopics, loading]);

  useEffect(() => {
    if (!svgRef.current) return;
    const nodeGroup = d3.select(svgRef.current).select(".nodes");
    if (nodeGroup.empty()) return;

    if (highlightedSubject) {
       nodeGroup.selectAll("g.node").transition().duration(300)
         .attr("opacity", d => (d.isSubject && d.label === highlightedSubject) || (!d.isSubject && d.subject === highlightedSubject) ? 1 : 0.2);
         
       d3.select(svgRef.current).select(".links").selectAll("line").transition().duration(300)
         .attr("stroke-opacity", d => (d.target?.label === highlightedSubject || d.source?.label === highlightedSubject) ? 0.6 : 0.05);
    } else {
       nodeGroup.selectAll("g.node").transition().duration(300).attr("opacity", 1);
       d3.select(svgRef.current).select(".links").selectAll("line").transition().duration(300).attr("stroke-opacity", 0.3);
    }
  }, [highlightedSubject]);

  return (
    <div 
      className="w-full bg-slate-900 rounded-xl relative shadow-2xl overflow-hidden min-h-[420px]" 
      ref={containerRef}
      onClick={() => setHighlightedSubject(null)}
    >
      {(!stats?.weakTopics || stats.weakTopics.length === 0) && !loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <p className="text-slate-400 font-medium text-lg px-6 text-center">Complete some reviews to see your knowledge map build up.</p>
        </div>
      )}

      <svg ref={svgRef} className="w-full h-[420px] block relative z-10" />
      
      <div className="absolute bottom-4 left-4 flex gap-4 bg-slate-800/80 backdrop-blur rounded-lg px-4 py-2 border border-slate-700 z-20">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm border border-red-400"></div>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Weak</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm border border-amber-400"></div>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Learning</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm border border-green-400"></div>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Strong</span>
        </div>
      </div>
    </div>
  );
}
