'use client';

import React from 'react';

interface WalnutShelfProps {
  shelfLength?: number;
  shelfDepth?: number;
  shelfThickness?: number;
}

export const WalnutShelf: React.FC<WalnutShelfProps> = ({
  shelfLength = 50,
  shelfDepth = 3.6,
  shelfThickness = 0.35,
}) => {
  const halfLength = shelfLength / 2;
  const cabinetHeight = 6.8;

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Main Base Plank (แผ่นวางหนังสือชั้นล่าง) */}
      <mesh receiveShadow castShadow position={[0, -0.175, 0]}>
        <boxGeometry args={[shelfLength, shelfThickness, shelfDepth]} />
        <meshStandardMaterial
          color="#382115" // Warm oiled walnut
          roughness={0.65}
          metalness={0.08}
        />
      </mesh>

      {/* 2. Front Edge Molding (ขอบคิ้วไม้หน้าตู้ชั้นล่าง เพิ่มมิติมุมมองตรง) */}
      <mesh receiveShadow castShadow position={[0, -0.22, shelfDepth / 2 - 0.05]}>
        <boxGeometry args={[shelfLength, 0.45, 0.25]} />
        <meshStandardMaterial
          color="#2a180e"
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>

      {/* 3. Back Panel (แผ่นหลังตู้ไม้ลายวอลนัต) */}
      <mesh receiveShadow position={[0, cabinetHeight / 2 - 0.175, -shelfDepth / 2 + 0.05]}>
        <boxGeometry args={[shelfLength, cabinetHeight, 0.15]} />
        <meshStandardMaterial
          color="#1e110a" // Shadowed rich dark walnut backboard
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>

      {/* 4. Top Shelf / Cabinet Crown (หลังคา/ชั้นบนสุดของตู้ไม้) */}
      <mesh receiveShadow castShadow position={[0, cabinetHeight - 0.175, 0]}>
        <boxGeometry args={[shelfLength, shelfThickness * 1.3, shelfDepth + 0.2]} />
        <meshStandardMaterial
          color="#382115"
          roughness={0.65}
          metalness={0.08}
        />
      </mesh>

      {/* 5. Left Cabinet Wall (เสาข้างซ้ายตู้ไม้) */}
      <mesh receiveShadow castShadow position={[-halfLength, cabinetHeight / 2 - 0.175, 0]}>
        <boxGeometry args={[0.5, cabinetHeight, shelfDepth]} />
        <meshStandardMaterial
          color="#2d1a10"
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>

      {/* 6. Right Cabinet Wall (เสาข้างขวาตู้ไม้) */}
      <mesh receiveShadow castShadow position={[halfLength, cabinetHeight / 2 - 0.175, 0]}>
        <boxGeometry args={[0.5, cabinetHeight, shelfDepth]} />
        <meshStandardMaterial
          color="#2d1a10"
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>

      {/* 7. Warm Atmospheric Cabinet Downlight (ไฟซ่อนเพดานตู้ไม้อบอุ่น) */}
      <pointLight position={[0, cabinetHeight - 0.8, 0.8]} intensity={1.8} color="#ffe1b3" distance={18} />
      <pointLight position={[-10, cabinetHeight - 0.8, 0.8]} intensity={1.2} color="#ffe1b3" distance={15} />
      <pointLight position={[10, cabinetHeight - 0.8, 0.8]} intensity={1.2} color="#ffe1b3" distance={15} />
    </group>
  );
};
