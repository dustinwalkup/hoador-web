"use client";

import { useEffect, useRef } from "react";

interface SparklineProps {
  data: number[];
  width: number;
  height: number;
  color: string;
}

export function Sparkline({ data, width, height, color }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set up dimensions
    const dataMax = Math.max(...data);
    const dataMin = Math.min(...data);
    const range = dataMax - dataMin;
    const step = width / (data.length - 1);

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    data.forEach((value, index) => {
      const x = index * step;
      const y = height - ((value - dataMin) / range) * (height * 0.8);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw fill
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = `${color}20`; // 20 is hex for 12% opacity
    ctx.fill();

    // Draw dots at data points
    ctx.fillStyle = color;
    data.forEach((value, index) => {
      const x = index * step;
      const y = height - ((value - dataMin) / range) * (height * 0.8);

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [data, width, height, color]);

  return <canvas ref={canvasRef} width={width} height={height} />;
}
