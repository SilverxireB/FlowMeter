"use client";

import { useEffect, useState } from "react";

export default function Snowflakes() {
  const [flakes, setFlakes] = useState<{ id: number; x: number; delay: number; duration: number; size: number; opacity: number }[]>([]);

  useEffect(() => {
    // Generate 40 random snowflakes
    const arr = [];
    for (let i = 0; i < 40; i++) {
      arr.push({
        id: i,
        x: Math.random() * 100, // vw
        delay: Math.random() * 10, // seconds
        duration: 10 + Math.random() * 15, // 10s - 25s
        size: 0.2 + Math.random() * 0.8, // 0.2rem - 1rem
        opacity: 0.2 + Math.random() * 0.6,
      });
    }
    setFlakes(arr);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {flakes.map((f) => (
        <div
          key={f.id}
          className="absolute top-[-5vh] rounded-full bg-white"
          style={{
            left: `${f.x}vw`,
            width: `${f.size}rem`,
            height: `${f.size}rem`,
            opacity: f.opacity,
            animation: `snowfall ${f.duration}s linear ${f.delay}s infinite`,
            filter: "blur(1px)",
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes snowfall {
          0% {
            transform: translateY(0) translateX(0) rotate(0deg);
          }
          50% {
            transform: translateY(55vh) translateX(10vw) rotate(180deg);
          }
          100% {
            transform: translateY(110vh) translateX(-10vw) rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
