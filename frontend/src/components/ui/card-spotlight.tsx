import { useMotionValue, motion, useMotionTemplate } from "motion/react";
import { type MouseEvent as ReactMouseEvent, type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Aceternity UI "Card Spotlight"
 * マウス追従のスポットライトで、ドットパターン層が浮かび上がるカード。
 * （公式の three.js / @react-three/fiber 製 CanvasRevealEffect は使わず、
 *   CSS ドットパターン + motion のマウス追従マスクで同等の見た目を軽量実装）
 */
export const CardSpotlight = ({
  children,
  radius = 350,
  color = "#1d4ed8",
  className,
}: {
  children: ReactNode;
  radius?: number;
  color?: string;
  className?: string;
}) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: ReactMouseEvent<HTMLDivElement>) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const [isHovering, setIsHovering] = useState(false);

  const maskImage = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, white, transparent 80%)`;

  return (
    <div
      className={cn(
        "group/spotlight relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 p-8",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px z-0 rounded-2xl opacity-0 transition duration-300 group-hover/spotlight:opacity-100"
        style={{
          backgroundColor: color,
          maskImage,
          WebkitMaskImage: maskImage,
        }}
      >
        {isHovering && (
          <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.4)_1px,transparent_0)] [background-size:12px_12px]" />
        )}
      </motion.div>
      <div className="relative z-10">{children}</div>
    </div>
  );
};
