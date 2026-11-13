'use client';

import React, { useMemo } from 'react';

interface WardrobeRackProps {
  rackLength?: number;
  rackDepth?: number;
}

/**
 * Warm architectural boutique garment rack / wardrobe frame.
 * Features an oiled walnut plinth, plaster/walnut architectural backdrop,
 * brushed brass frame posts & hanging rail at y = 4.35, and warm boutique downlights.
 */
export const WardrobeRack: React.FC<WardrobeRackProps> = ({
  rackLength = 50,
  rackDepth = 3.8,
}) => {
  const halfLength = rackLength / 2;
  const railHeight = 4.35;
  const canopyHeight = 5.05;

  // Architectural pilaster & ceiling drop-rod positions along the rack
  const bayPositions = useMemo(() => {
    const span = 6.5;
    const count = Math.max(2, Math.floor((rackLength - 4) / span));
    const start = -((count - 1) * span) / 2;
    return Array.from({ length: count }, (_, idx) => start + idx * span);
  }, [rackLength]);

  // Balanced warm downlight positions (max 5 for consistent mobile/desktop FPS)
  const lightPositions = useMemo(() => {
    const maxOffset = Math.min(18, halfLength - 3);
    if (maxOffset <= 4) return [0];
    return [-maxOffset, -maxOffset * 0.5, 0, maxOffset * 0.5, maxOffset];
  }, [halfLength]);

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Oiled Walnut Base Plinth (แท่นวางพื้นไม้วอลนัตขัดน้ำมัน) */}
      <mesh receiveShadow castShadow position={[0, -0.18, 0]}>
        <boxGeometry args={[rackLength, 0.36, rackDepth]} />
        <meshStandardMaterial color="#382115" roughness={0.62} metalness={0.08} />
      </mesh>

      {/* Recessed Shadow Skirt under Plinth */}
      <mesh receiveShadow position={[0, -0.44, -0.08]}>
        <boxGeometry args={[rackLength - 0.3, 0.18, rackDepth - 0.3]} />
        <meshStandardMaterial color="#190f0a" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* 2. Front Edge Molding & Brushed Brass Inlay Trim */}
      <mesh receiveShadow castShadow position={[0, -0.21, rackDepth / 2 - 0.04]}>
        <boxGeometry args={[rackLength, 0.42, 0.24]} />
        <meshStandardMaterial color="#2a180e" roughness={0.58} metalness={0.1} />
      </mesh>
      <mesh position={[0, -0.04, rackDepth / 2 + 0.085]}>
        <boxGeometry args={[rackLength - 0.4, 0.045, 0.03]} />
        <meshStandardMaterial color="#c9a35b" roughness={0.28} metalness={0.82} />
      </mesh>

      {/* 3. Back Boutique Wall & Warm Plaster / Walnut Paneling */}
      <mesh receiveShadow position={[0, canopyHeight / 2 - 0.1, -rackDepth / 2 + 0.06]}>
        <boxGeometry args={[rackLength, canopyHeight + 0.35, 0.16]} />
        <meshStandardMaterial color="#1e1612" roughness={0.84} metalness={0.04} />
      </mesh>

      {/* Horizontal walnut dado trim across back wall */}
      <mesh receiveShadow position={[0, 1.05, -rackDepth / 2 + 0.16]}>
        <boxGeometry args={[rackLength - 0.6, 0.1, 0.08]} />
        <meshStandardMaterial color="#362014" roughness={0.62} metalness={0.08} />
      </mesh>

      {/* Vertical Architectural Walnut Pilasters & Warm Cove Strips */}
      {bayPositions.map((bx, idx) => (
        <group key={`bay-${idx}`} position={[bx, 0, 0]}>
          {/* Back wall walnut pilaster */}
          <mesh receiveShadow position={[0, canopyHeight / 2 - 0.08, -rackDepth / 2 + 0.18]}>
            <boxGeometry args={[0.24, canopyHeight + 0.2, 0.14]} />
            <meshStandardMaterial color="#2e1b11" roughness={0.65} metalness={0.08} />
          </mesh>

          {/* Subtle brass ceiling suspension rod holding the hanging rail cleanly */}
          <mesh castShadow position={[0, (railHeight + canopyHeight) / 2, 0]}>
            <cylinderGeometry args={[0.03, 0.03, canopyHeight - railHeight, 12]} />
            <meshStandardMaterial color="#c9a35b" roughness={0.26} metalness={0.85} />
          </mesh>

          {/* Brass rail collar ring around suspension point */}
          <mesh position={[0, railHeight, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.085, 0.085, 0.12, 16]} />
            <meshStandardMaterial color="#b38c46" roughness={0.28} metalness={0.86} />
          </mesh>
        </group>
      ))}

      {/* 4. Top Architectural Walnut Canopy & Recessed Light Strip */}
      <mesh receiveShadow castShadow position={[0, canopyHeight, 0.12]}>
        <boxGeometry args={[rackLength + 0.3, 0.32, rackDepth + 0.45]} />
        <meshStandardMaterial color="#331e13" roughness={0.62} metalness={0.08} />
      </mesh>

      {/* Brushed brass canopy fascia accent */}
      <mesh position={[0, canopyHeight - 0.12, rackDepth / 2 + 0.35]}>
        <boxGeometry args={[rackLength + 0.3, 0.05, 0.03]} />
        <meshStandardMaterial color="#c9a35b" roughness={0.26} metalness={0.84} />
      </mesh>

      {/* Recessed Warm Cove Light Strip under Canopy */}
      <mesh position={[0, canopyHeight - 0.17, 0.55]}>
        <boxGeometry args={[rackLength - 1.2, 0.03, 0.18]} />
        <meshStandardMaterial
          color="#fff1d6"
          emissive="#ffdca8"
          emissiveIntensity={1.15}
          roughness={0.2}
        />
      </mesh>

      {/* 5. Dark Bronze / Brushed Brass End Frame Uprights */}
      {[-halfLength, halfLength].map((endX, idx) => (
        <group key={`end-${idx}`} position={[endX, 0, 0]}>
          {/* Front vertical post */}
          <mesh castShadow receiveShadow position={[0, canopyHeight / 2 - 0.1, rackDepth / 2 - 0.28]}>
            <boxGeometry args={[0.16, canopyHeight + 0.25, 0.16]} />
            <meshStandardMaterial color="#3c2f24" roughness={0.35} metalness={0.72} />
          </mesh>
          {/* Rear vertical post */}
          <mesh castShadow receiveShadow position={[0, canopyHeight / 2 - 0.1, -rackDepth / 2 + 0.28]}>
            <boxGeometry args={[0.16, canopyHeight + 0.25, 0.16]} />
            <meshStandardMaterial color="#3c2f24" roughness={0.35} metalness={0.72} />
          </mesh>
          {/* Side crossbar connecting front & rear post at rail level */}
          <mesh castShadow position={[0, railHeight, 0]}>
            <boxGeometry args={[0.11, 0.11, rackDepth - 0.5]} />
            <meshStandardMaterial color="#c49d56" roughness={0.28} metalness={0.84} />
          </mesh>
          {/* Solid walnut side surround accent */}
          <mesh receiveShadow castShadow position={[idx === 0 ? -0.14 : 0.14, canopyHeight / 2 - 0.1, 0]}>
            <boxGeometry args={[0.2, canopyHeight + 0.25, rackDepth]} />
            <meshStandardMaterial color="#2c1a10" roughness={0.68} metalness={0.06} />
          </mesh>
        </group>
      ))}

      {/* 6. Horizontal Brushed Brass Hanging Rail (ราวแขวนเสื้อทองเหลืองขัดเงา y = 4.35) */}
      <mesh castShadow receiveShadow position={[0, railHeight, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.055, 0.055, rackLength, 24]} />
        <meshStandardMaterial color="#d4ae67" roughness={0.22} metalness={0.88} />
      </mesh>

      {/* Top Crossbar Brass Tie */}
      <mesh position={[0, canopyHeight - 0.34, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.032, 0.032, rackLength, 16]} />
        <meshStandardMaterial color="#b9934c" roughness={0.3} metalness={0.84} />
      </mesh>

      {/* 7. Subtle Warm Boutique Downlights */}
      {lightPositions.map((lx, idx) => (
        <pointLight
          key={`light-${idx}`}
          position={[lx, canopyHeight - 0.42, 0.95]}
          intensity={1.55}
          color="#ffe3b8"
          distance={16}
          decay={1.6}
        />
      ))}
    </group>
  );
};
