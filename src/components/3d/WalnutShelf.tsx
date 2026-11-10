'use client';

import React from 'react';

interface WalnutShelfProps {
  shelfLength?: number;
  shelfDepth?: number;
  shelfThickness?: number;
}

export const WalnutShelf: React.FC<WalnutShelfProps> = ({
  shelfLength = 50,
  shelfDepth = 4.5,
  shelfThickness = 0.35,
}) => {
  return (
    <group position={[0, -0.175, 0]}>
      {/* Horizontal Walnut Plank */}
      <mesh receiveShadow castShadow position={[0, 0, 0]}>
        <boxGeometry args={[shelfLength, shelfThickness, shelfDepth]} />
        <meshStandardMaterial
          color="#2e1b12" // Rich warm oiled walnut
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Backboard panel */}
      <mesh receiveShadow position={[0, 4.5, -shelfDepth / 2 - 0.1]}>
        <boxGeometry args={[shelfLength, 9, 0.2]} />
        <meshStandardMaterial
          color="#1e120c" // Darker shadowed walnut back wall
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* Top shelf row for architectural depth */}
      <mesh receiveShadow castShadow position={[0, 5.2, 0]}>
        <boxGeometry args={[shelfLength, shelfThickness, shelfDepth]} />
        <meshStandardMaterial
          color="#2e1b12"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Subtle warm under-shelf light strip */}
      <pointLight position={[0, 4.9, 0.5]} intensity={1.5} color="#ffe2b3" distance={15} />
    </group>
  );
};
