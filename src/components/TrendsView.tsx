import { useState, useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, 
  BarChart3, 
  Calendar, 
  Clock, 
  Smile, 
  FileText, 
  ArrowRight, 
  Sparkles, 
  Flame, 
  Activity,
  Layers,
  HelpCircle,
  BookOpen
} from 'lucide-react';
import { JournalEntry } from '../types';
import { getMoodEmoji } from './HistorySidebar';

interface TrendsViewProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
  onBackToJournal: () => void;
}

type TimeRangeOption = '7d' | '30d' | '90d' | 'all';
type MetricUnit = 'words' | 'characters';

const MOOD_COLORS: Record<string, string> = {
  Happy: '#f59e0b',       // amber
  Reflective: '#38bdf8',  // sky
  Stressed: '#f43f5e',    // rose
  Grateful: '#10b981',    // emerald
  Energized: '#a855f7',   // purple
  Calm: '#06b6d4',        // cyan
  Challenged: '#f97316',  // orange
  Other: '#94a3b8',       // slate
};

function getMoodColor(mood?: string): string {
  if (!mood) return MOOD_COLORS.Reflective;
  const canonical = Object.keys(MOOD_COLORS).find(
    (k) => k.toLowerCase() === mood.trim().toLowerCase()
  );
  return canonical ? MOOD_COLORS[canonical] : MOOD_COLORS.Other;
}

function countWords(str: string): number {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

export function TrendsView({ entries, onSelectEntry, onBackToJournal }: TrendsViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('30d');
  const [metricUnit, setMetricUnit] = useState<MetricUnit>('words');
  const [activeMoodFilter, setActiveMoodFilter] = useState<string | null>(null);

  // Tooltip state for D3 charts
  const [tooltipData, setTooltipData] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    subtitle: string;
    badge?: string;
    badgeColor?: string;
    metricLabel?: string;
    metricValue?: string | number;
    entry?: JournalEntry;
  } | null>(null);

  // SVG Refs
  const timelineSvgRef = useRef<SVGSVGElement | null>(null);
  const moodDistributionSvgRef = useRef<SVGSVGElement | null>(null);
  const moodLengthSvgRef = useRef<SVGSVGElement | null>(null);
  const dayOfWeekSvgRef = useRef<SVGSVGElement | null>(null);

  // 1. Filter entries by time range
  const filteredEntries = useMemo(() => {
    const now = Date.now();
    let cutoff = 0;
    if (timeRange === '7d') cutoff = now - 7 * 86400 * 1000;
    else if (timeRange === '30d') cutoff = now - 30 * 86400 * 1000;
    else if (timeRange === '90d') cutoff = now - 90 * 86400 * 1000;
    else cutoff = 0;

    const list = entries.filter((e) => e.createdAt >= cutoff);
    // Sort chronologically ascending
    return [...list].sort((a, b) => a.createdAt - b.createdAt);
  }, [entries, timeRange]);

  // 2. Summary KPI Calculations
  const stats = useMemo(() => {
    const totalCount = filteredEntries.length;
    if (totalCount === 0) {
      return {
        totalCount: 0,
        avgLength: 0,
        maxLength: 0,
        totalWords: 0,
        dominantMood: 'None',
        dominantMoodEmoji: '🌱',
        dominantMoodColor: '#94a3b8',
        avgReflectionsPerWeek: '0.0',
      };
    }

    let totalWords = 0;
    let totalChars = 0;
    let maxLength = 0;
    const moodCounts: Record<string, number> = {};

    filteredEntries.forEach((e) => {
      const words = countWords(e.content);
      const chars = (e.content || '').length;
      totalWords += words;
      totalChars += chars;
      const lengthVal = metricUnit === 'words' ? words : chars;
      if (lengthVal > maxLength) maxLength = lengthVal;

      const m = (e.mood || 'Reflective').trim();
      moodCounts[m] = (moodCounts[m] || 0) + 1;
    });

    let dominantMood = 'Reflective';
    let maxMoodCount = 0;
    Object.entries(moodCounts).forEach(([m, count]) => {
      if (count > maxMoodCount) {
        maxMoodCount = count;
        dominantMood = m;
      }
    });

    const activeLength = metricUnit === 'words' ? totalWords : totalChars;
    const avgLength = Math.round(activeLength / totalCount);

    // Reflections per week in period
    const daySpan = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : Math.max(7, Math.ceil((Date.now() - (filteredEntries[0]?.createdAt || Date.now())) / (86400000)));
    const avgReflectionsPerWeek = ((totalCount / daySpan) * 7).toFixed(1);

    return {
      totalCount,
      avgLength,
      maxLength,
      totalWords,
      dominantMood,
      dominantMoodEmoji: getMoodEmoji(dominantMood),
      dominantMoodColor: getMoodColor(dominantMood),
      avgReflectionsPerWeek,
    };
  }, [filteredEntries, metricUnit, timeRange]);

  // -------------------------------------------------------------
  // D3 Chart 1: Reflection Length & Mood Scatter Over Time (Time Series)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!timelineSvgRef.current) return;
    const svgEl = timelineSvgRef.current;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const containerWidth = svgEl.parentElement?.clientWidth || 700;
    const width = Math.max(320, containerWidth);
    const height = 300;
    const margin = { top: 25, right: 25, bottom: 40, left: 55 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    if (filteredEntries.length === 0) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#78716c')
        .attr('font-size', '13px')
        .text('No reflections recorded in this time range');
      return;
    }

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare data
    const data = filteredEntries.map((e) => {
      const lengthVal = metricUnit === 'words' ? countWords(e.content) : (e.content || '').length;
      return {
        entry: e,
        date: new Date(e.createdAt),
        length: lengthVal,
        mood: e.mood || 'Reflective',
        color: getMoodColor(e.mood),
      };
    });

    // Scales
    const xExtent = d3.extent(data, (d) => d.date) as [Date, Date];
    // If only one day or single point, expand bounds
    if (xExtent[0].getTime() === xExtent[1].getTime()) {
      xExtent[0] = new Date(xExtent[0].getTime() - 86400000);
      xExtent[1] = new Date(xExtent[1].getTime() + 86400000);
    }

    const xScale = d3.scaleTime()
      .domain(xExtent)
      .range([0, innerWidth]);

    const maxVal = d3.max(data, (d) => d.length) || 100;
    const yScale = d3.scaleLinear()
      .domain([0, Math.ceil(maxVal * 1.15)])
      .nice()
      .range([innerHeight, 0]);

    // Gridlines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', '#a8a29e');

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.min(width > 500 ? 8 : 4, data.length))
      .tickFormat((d) => d3.timeFormat(timeRange === '7d' ? '%a %d' : '%b %d')(d as Date));

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => `${d}`);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', '#78716c')
      .selectAll('text')
      .attr('fill', '#a8a29e')
      .attr('font-size', '11px');

    g.append('g')
      .call(yAxis)
      .attr('color', '#78716c')
      .selectAll('text')
      .attr('fill', '#a8a29e')
      .attr('font-size', '11px');

    // Gradient for area fill
    const defs = svg.append('defs');
    const areaGradient = defs.append('linearGradient')
      .attr('id', 'length-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#f59e0b')
      .attr('stop-opacity', 0.35);

    areaGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#f59e0b')
      .attr('stop-opacity', 0.0);

    // Area & Line generator (smooth curve)
    const area = d3.area<any>()
      .curve(d3.curveMonotoneX)
      .x((d) => xScale(d.date))
      .y0(innerHeight)
      .y1((d) => yScale(d.length));

    const line = d3.line<any>()
      .curve(d3.curveMonotoneX)
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.length));

    // Area fill
    g.append('path')
      .datum(data)
      .attr('fill', 'url(#length-gradient)')
      .attr('d', area);

    // Main Trend Line
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2.5)
      .attr('d', line);

    // Moving Average Line (if >= 4 points)
    if (data.length >= 4) {
      const movingAvgData = data.map((d, i, arr) => {
        const start = Math.max(0, i - 2);
        const window = arr.slice(start, i + 1);
        const avg = d3.mean(window, (w) => w.length) || d.length;
        return { date: d.date, avg };
      });

      const avgLine = d3.line<any>()
        .curve(d3.curveBasis)
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.avg));

      g.append('path')
        .datum(movingAvgData)
        .attr('fill', 'none')
        .attr('stroke', '#38bdf8')
        .attr('stroke-width', 1.8)
        .attr('stroke-dasharray', '4 3')
        .attr('opacity', 0.8)
        .attr('d', avgLine);
    }

    // Data points (Dots colored by mood)
    const dots = g.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', (d) => xScale(d.date))
      .attr('cy', (d) => yScale(d.length))
      .attr('r', 5.5)
      .attr('fill', (d) => d.color)
      .attr('stroke', '#1c1917')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .style('transition', 'r 0.15s ease, stroke 0.15s ease');

    dots.on('mouseenter', (event: MouseEvent, d) => {
      d3.select(event.currentTarget as SVGCircleElement)
        .attr('r', 8)
        .attr('stroke', '#fef3c7')
        .attr('stroke-width', 2.5);

      const [clientX, clientY] = [event.clientX, event.clientY];
      setTooltipData({
        visible: true,
        x: clientX,
        y: clientY,
        title: d.entry.title || 'Untitled Reflection',
        subtitle: d.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        badge: `${getMoodEmoji(d.mood)} ${d.mood}`,
        badgeColor: d.color,
        metricLabel: metricUnit === 'words' ? 'Word Count' : 'Characters',
        metricValue: `${d.length.toLocaleString()} ${metricUnit}`,
        entry: d.entry,
      });
    })
    .on('mouseleave', (event: MouseEvent) => {
      d3.select(event.currentTarget as SVGCircleElement)
        .attr('r', 5.5)
        .attr('stroke', '#1c1917')
        .attr('stroke-width', 2);
      setTooltipData(null);
    })
    .on('click', (_event, d) => {
      onSelectEntry(d.entry);
    });

  }, [filteredEntries, metricUnit, timeRange, onSelectEntry]);

  // -------------------------------------------------------------
  // D3 Chart 2: Mood Frequency Distribution (Donut Chart)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!moodDistributionSvgRef.current) return;
    const svgEl = moodDistributionSvgRef.current;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 260;
    const height = 260;
    const radius = Math.min(width, height) / 2 - 16;
    const innerRadius = radius * 0.62;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    if (filteredEntries.length === 0) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#78716c')
        .attr('font-size', '12px')
        .text('No entries');
      return;
    }

    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

    // Aggregate counts by mood
    const countsMap = new Map<string, number>();
    filteredEntries.forEach((e) => {
      const m = (e.mood || 'Reflective').trim();
      countsMap.set(m, (countsMap.get(m) || 0) + 1);
    });

    const moodData = Array.from(countsMap.entries()).map(([mood, count]) => ({
      mood,
      count,
      color: getMoodColor(mood),
      emoji: getMoodEmoji(mood),
      percentage: Math.round((count / filteredEntries.length) * 100),
    }));

    // Pie and Arc
    const pie = d3.pie<any>()
      .value((d) => d.count)
      .sort(null)
      .padAngle(0.03);

    const arc = d3.arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .cornerRadius(4);

    const hoverArc = d3.arc<any>()
      .innerRadius(innerRadius - 2)
      .outerRadius(radius + 6)
      .cornerRadius(5);

    const arcs = g.selectAll('.arc')
      .data(pie(moodData))
      .enter()
      .append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color)
      .attr('stroke', '#1c1917')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .style('transition', 'all 0.2s ease')
      .on('mouseenter', (event: MouseEvent, d) => {
        d3.select(event.currentTarget as SVGPathElement)
          .transition()
          .duration(150)
          .attr('d', hoverArc);

        setTooltipData({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          title: `${d.data.emoji} ${d.data.mood}`,
          subtitle: `${d.data.count} ${d.data.count === 1 ? 'reflection' : 'reflections'}`,
          badge: `${d.data.percentage}% of period`,
          badgeColor: d.data.color,
          metricLabel: 'Entries Share',
          metricValue: `${d.data.count} / ${filteredEntries.length}`,
        });
      })
      .on('mouseleave', (event: MouseEvent) => {
        d3.select(event.currentTarget as SVGPathElement)
          .transition()
          .duration(150)
          .attr('d', arc);
        setTooltipData(null);
      })
      .on('click', (_event, d) => {
        setActiveMoodFilter(activeMoodFilter === d.data.mood ? null : d.data.mood);
      });

    // Center Label: Dominant Mood
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .attr('fill', '#a8a29e')
      .attr('font-size', '11px')
      .text('DOMINANT');

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .attr('fill', stats.dominantMoodColor)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .text(`${stats.dominantMoodEmoji} ${stats.dominantMood}`);

  }, [filteredEntries, stats, activeMoodFilter]);

  // -------------------------------------------------------------
  // D3 Chart 3: Average Reflection Length by Mood (Bar Chart)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!moodLengthSvgRef.current) return;
    const svgEl = moodLengthSvgRef.current;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const containerWidth = svgEl.parentElement?.clientWidth || 360;
    const width = Math.max(280, containerWidth);
    const height = 240;
    const margin = { top: 20, right: 20, bottom: 45, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    if (filteredEntries.length === 0) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#78716c')
        .attr('font-size', '12px')
        .text('No entries');
      return;
    }

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Compute average length per mood
    const map = new Map<string, { totalLen: number; count: number }>();
    filteredEntries.forEach((e) => {
      const m = (e.mood || 'Reflective').trim();
      const len = metricUnit === 'words' ? countWords(e.content) : (e.content || '').length;
      const prev = map.get(m) || { totalLen: 0, count: 0 };
      map.set(m, { totalLen: prev.totalLen + len, count: prev.count + 1 });
    });

    const barData = Array.from(map.entries())
      .map(([mood, val]) => ({
        mood,
        avgLen: Math.round(val.totalLen / val.count),
        count: val.count,
        color: getMoodColor(mood),
        emoji: getMoodEmoji(mood),
      }))
      .sort((a, b) => b.avgLen - a.avgLen);

    const xScale = d3.scaleBand()
      .domain(barData.map((d) => d.mood))
      .range([0, innerWidth])
      .padding(0.3);

    const maxAvg = d3.max(barData, (d) => d.avgLen) || 100;
    const yScale = d3.scaleLinear()
      .domain([0, Math.ceil(maxAvg * 1.15)])
      .nice()
      .range([innerHeight, 0]);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat((d) => `${getMoodEmoji(d)}`))
      .attr('color', '#78716c')
      .selectAll('text')
      .attr('fill', '#e7e5e4')
      .attr('font-size', '12px');

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
      .attr('color', '#78716c')
      .selectAll('text')
      .attr('fill', '#a8a29e')
      .attr('font-size', '10px');

    // Bars
    g.selectAll('.bar')
      .data(barData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => xScale(d.mood) || 0)
      .attr('y', (d) => yScale(d.avgLen))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => innerHeight - yScale(d.avgLen))
      .attr('rx', 4)
      .attr('fill', (d) => d.color)
      .attr('cursor', 'pointer')
      .attr('opacity', 0.85)
      .on('mouseenter', (event: MouseEvent, d) => {
        d3.select(event.currentTarget as SVGRectElement).attr('opacity', 1.0);
        setTooltipData({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          title: `${d.emoji} ${d.mood}`,
          subtitle: `Average Depth: ${d.avgLen} ${metricUnit}`,
          badge: `${d.count} ${d.count === 1 ? 'entry' : 'entries'}`,
          badgeColor: d.color,
          metricLabel: 'Avg Reflection Depth',
          metricValue: `${d.avgLen} ${metricUnit}`,
        });
      })
      .on('mouseleave', (event: MouseEvent) => {
        d3.select(event.currentTarget as SVGRectElement).attr('opacity', 0.85);
        setTooltipData(null);
      });

  }, [filteredEntries, metricUnit]);

  // -------------------------------------------------------------
  // D3 Chart 4: Day of Week Writing Patterns (Heatmap / Bar Chart)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!dayOfWeekSvgRef.current) return;
    const svgEl = dayOfWeekSvgRef.current;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const containerWidth = svgEl.parentElement?.clientWidth || 360;
    const width = Math.max(280, containerWidth);
    const height = 240;
    const margin = { top: 20, right: 20, bottom: 45, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    if (filteredEntries.length === 0) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#78716c')
        .attr('font-size', '12px')
        .text('No entries');
      return;
    }

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    filteredEntries.forEach((e) => {
      const dayIdx = new Date(e.createdAt).getDay();
      counts[dayIdx] = (counts[dayIdx] || 0) + 1;
    });

    const dayData = days.map((day, idx) => ({
      day,
      count: counts[idx],
    }));

    const xScale = d3.scaleBand()
      .domain(days)
      .range([0, innerWidth])
      .padding(0.3);

    const maxCount = d3.max(counts) || 5;
    const yScale = d3.scaleLinear()
      .domain([0, Math.ceil(maxCount * 1.2)])
      .nice()
      .range([innerHeight, 0]);

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .attr('color', '#78716c')
      .selectAll('text')
      .attr('fill', '#a8a29e')
      .attr('font-size', '11px');

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
      .attr('color', '#78716c')
      .selectAll('text')
      .attr('fill', '#a8a29e')
      .attr('font-size', '10px');

    // Bars
    g.selectAll('.day-bar')
      .data(dayData)
      .enter()
      .append('rect')
      .attr('class', 'day-bar')
      .attr('x', (d) => xScale(d.day) || 0)
      .attr('y', (d) => yScale(d.count))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => innerHeight - yScale(d.count))
      .attr('rx', 4)
      .attr('fill', (d) => (d.count === maxCount && d.count > 0 ? '#f59e0b' : '#38bdf8'))
      .attr('opacity', 0.8)
      .attr('cursor', 'pointer')
      .on('mouseenter', (event: MouseEvent, d) => {
        d3.select(event.currentTarget as SVGRectElement).attr('opacity', 1.0);
        setTooltipData({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          title: `${d.day} Reflections`,
          subtitle: `${d.count} ${d.count === 1 ? 'entry' : 'entries'} written on ${d.day}`,
          badge: d.count === maxCount ? 'Peak Day 🔥' : 'Rhythm',
          badgeColor: d.count === maxCount ? '#f59e0b' : '#38bdf8',
          metricLabel: 'Entry Frequency',
          metricValue: `${d.count} entries`,
        });
      })
      .on('mouseleave', (event: MouseEvent) => {
        d3.select(event.currentTarget as SVGRectElement).attr('opacity', 0.8);
        setTooltipData(null);
      });

  }, [filteredEntries]);

  return (
    <div className="flex-1 flex flex-col gap-4 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="trends-view-heading" className="text-lg font-bold text-stone-100">
                  Reflection Trends & Analytics
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-mono">
                  D3 Visualization Engine
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Visualizing mood rhythms, reflection length evolution, and personal writing habits over time
              </p>
            </div>
          </div>

          {/* Controls: Time Range & Metric Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Metric Unit Toggle */}
            <div className="flex items-center bg-stone-950 border border-stone-800 rounded-xl p-0.5 text-xs">
              <button
                id="trends-metric-words"
                onClick={() => setMetricUnit('words')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  metricUnit === 'words'
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Words
              </button>
              <button
                id="trends-metric-chars"
                onClick={() => setMetricUnit('characters')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  metricUnit === 'characters'
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Characters
              </button>
            </div>

            {/* Time Range Pills */}
            <div className="flex items-center bg-stone-950 border border-stone-800 rounded-xl p-0.5 text-xs">
              {(['7d', '30d', '90d', 'all'] as TimeRangeOption[]).map((range) => (
                <button
                  key={range}
                  id={`trends-range-${range}`}
                  onClick={() => setTimeRange(range)}
                  className={`px-2.5 py-1 rounded-lg font-medium uppercase transition-all cursor-pointer ${
                    timeRange === range
                      ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {range === 'all' ? 'All Time' : range}
                </button>
              ))}
            </div>

            <button
              id="trends-back-to-editor-btn"
              onClick={onBackToJournal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors cursor-pointer shadow-xs ml-1"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Journal Editor</span>
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-stone-800/80 text-xs">
          <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/70 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Reflections In Scope</p>
              <p className="text-base font-bold text-stone-100">{stats.totalCount}</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/70 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Avg Reflection Depth</p>
              <p className="text-base font-bold text-stone-100">
                {stats.avgLength.toLocaleString()} <span className="text-xs font-normal text-stone-400">{metricUnit}</span>
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/70 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-sm shrink-0">
              {stats.dominantMoodEmoji}
            </div>
            <div>
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Dominant Mood</p>
              <p className="text-base font-bold text-stone-100">{stats.dominantMood}</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/70 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Writing Cadence</p>
              <p className="text-base font-bold text-stone-100">
                {stats.avgReflectionsPerWeek} <span className="text-xs font-normal text-stone-400">per week</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Time Series Area + Scatter (Full width on medium, 8 cols on desktop) */}
        <div className="lg:col-span-8 bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <span>Reflection Length & Mood Evolution Over Time</span>
              </h3>
              <p className="text-xs text-stone-400">
                Area indicates reflection volume. Dots represent reflections colored by mood. Dashed line tracks 3-point moving average.
              </p>
            </div>

            {/* Legend for Mood Dots */}
            <div className="flex items-center gap-2 flex-wrap text-[10px] text-stone-300">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Happy
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> Reflective
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" /> Stressed
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Grateful
              </span>
            </div>
          </div>

          <div className="w-full relative flex-1 min-h-[300px]">
            <svg ref={timelineSvgRef} className="w-full h-[300px] overflow-visible" />
          </div>
        </div>

        {/* Chart 2: Mood Frequency Distribution Donut (4 cols on desktop) */}
        <div className="lg:col-span-4 bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
              <Smile className="w-4 h-4 text-amber-400" />
              <span>Mood Frequency Distribution</span>
            </h3>
            <p className="text-xs text-stone-400">
              Proportion of emotional states recorded across this period. Hover arcs for details.
            </p>
          </div>

          <div className="w-full flex items-center justify-center flex-1 min-h-[250px]">
            <svg ref={moodDistributionSvgRef} className="w-[260px] h-[260px]" />
          </div>

          {/* Quick Mood Breakdown Chips */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2 border-t border-stone-800/80 text-[11px]">
            {Object.entries(MOOD_COLORS).map(([mood, color]) => {
              const count = filteredEntries.filter(
                (e) => (e.mood || 'Reflective').toLowerCase() === mood.toLowerCase()
              ).length;
              if (count === 0) return null;
              return (
                <span
                  key={mood}
                  className="px-2 py-0.5 rounded-full bg-stone-950 border border-stone-800 text-stone-300 flex items-center gap-1 font-mono text-[10px]"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span>{getMoodEmoji(mood)} {mood}</span>
                  <span className="text-stone-400 font-bold">({count})</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Chart 3: Average Length by Mood (6 cols on desktop) */}
        <div className="lg:col-span-6 bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span>Depth of Reflection by Mood</span>
            </h3>
            <p className="text-xs text-stone-400">
              Average {metricUnit} written per entry categorized by emotional state
            </p>
          </div>

          <div className="w-full relative flex-1 min-h-[240px]">
            <svg ref={moodLengthSvgRef} className="w-full h-[240px]" />
          </div>
        </div>

        {/* Chart 4: Day of Week Writing Rhythm (6 cols on desktop) */}
        <div className="lg:col-span-6 bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Day-of-Week Reflection Rhythm</span>
            </h3>
            <p className="text-xs text-stone-400">
              Identifying weekly habits and high-consistency journaling days
            </p>
          </div>

          <div className="w-full relative flex-1 min-h-[240px]">
            <svg ref={dayOfWeekSvgRef} className="w-full h-[240px]" />
          </div>
        </div>
      </div>

      {/* Floating Interactive Tooltip Card */}
      {tooltipData && tooltipData.visible && (
        <div
          className="fixed pointer-events-none z-50 p-3 rounded-xl bg-stone-950/95 border border-stone-700 shadow-2xl text-stone-100 max-w-xs backdrop-blur-md transition-opacity duration-100"
          style={{
            left: `${Math.min(window.innerWidth - 260, tooltipData.x + 12)}px`,
            top: `${Math.min(window.innerHeight - 150, tooltipData.y - 45)}px`,
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-xs font-bold text-stone-100 truncate">{tooltipData.title}</h4>
            {tooltipData.badge && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                style={{
                  backgroundColor: `${tooltipData.badgeColor || '#f59e0b'}25`,
                  color: tooltipData.badgeColor || '#f59e0b',
                }}
              >
                {tooltipData.badge}
              </span>
            )}
          </div>

          <p className="text-[10px] text-stone-400 mb-1">{tooltipData.subtitle}</p>

          {tooltipData.metricLabel && (
            <div className="mt-1 pt-1 border-t border-stone-800/80 flex items-center justify-between text-[11px]">
              <span className="text-stone-400">{tooltipData.metricLabel}:</span>
              <span className="font-bold text-amber-400">{tooltipData.metricValue}</span>
            </div>
          )}

          {tooltipData.entry && (
            <p className="text-[9px] text-amber-400/80 mt-1.5 flex items-center gap-1 font-mono">
              <span>Click dot to load in Editor</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </p>
          )}
        </div>
      )}
    </div>
  );
}
