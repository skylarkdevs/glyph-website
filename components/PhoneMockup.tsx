import { ReactNode } from "react";

/* Frame measurements from mockup.png (1022×2082) */
const MK_W = 1022;
const MK_H = 2082;
const SC_L = (52 / MK_W) * 100;
const SC_T = (46 / MK_H) * 100;
const SC_W = (918 / MK_W) * 100;
const SC_H = (1990 / MK_H) * 100;
const SC_RX = (126 / 918) * 100;
const SC_RY = (126 / 1990) * 100;

interface PhoneMockupProps {
  src?: string;
  alt?: string;
  animate?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}

const sizes = {
  sm: "w-[180px]",
  md: "w-[260px]",
  lg: "w-[300px]",
};

export default function PhoneMockup({ src, alt = "", animate = false, className = "", size = "md", children }: PhoneMockupProps) {
  return (
    <div
      className={`relative ${sizes[size]} ${animate ? "animate-float" : ""} ${className}`}
      style={{ aspectRatio: `${MK_W}/${MK_H}` }}
    >
      {/* Frame image (behind screen content) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/iphone-frame.png"
        alt=""
        className="block w-full h-full relative z-10 pointer-events-none"
        draggable={false}
      />

      {/* Screen content (on top of black screen area) */}
      <div
        className="absolute z-20 overflow-hidden"
        style={{
          left: `${SC_L}%`,
          top: `${SC_T}%`,
          width: `${SC_W}%`,
          height: `${SC_H}%`,
          borderRadius: `${SC_RX}% / ${SC_RY}%`,
        }}
      >
        {children || (
          src && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={src}
              alt={alt}
              className="block w-full h-full object-cover object-top"
              draggable={false}
              loading="lazy"
            />
          )
        )}
      </div>
    </div>
  );
}
