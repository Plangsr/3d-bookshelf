'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Shirt } from '@/types/shirt';
import { ShirtModel } from './ShirtModel';

interface ShirtInspectionViewProps {
  shirt: Shirt;
  onClose?: () => void;
}

/**
 * Interactive 360-degree boutique studio view for inspecting a single garment
 * with OrbitControls, warm key/rim lighting, and gentle hanging idle sway.
 */
export const ShirtInspectionView: React.FC<ShirtInspectionViewProps> = ({ shirt }) => {
  const groupRef = useRef<THREE.Group>(null);
  const lastShirtIdRef = useRef<string | null>(null);

  // Subtle boutique floating / hanger idle motion & camera reset on shirt switch
  useFrame((state) => {
    if (lastShirtIdRef.current !== shirt.id) {
      state.camera.position.set(0, 0.2, 4.9);
      state.camera.lookAt(0, 0.1, 0);
      lastShirtIdRef.current = shirt.id;
    }

    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.35) * 0.04;
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.65) * 0.06;
    }
  });

  return (
    <>
      {/* Studio Key, Rim & Fill Lighting to highlight fabric weave, collar & brass hanger */}
      <ambientLight intensity={0.78} />
      <directionalLight position={[5, 8, 6]} intensity={1.8} castShadow color="#fffaf0" />
      <directionalLight position={[-5, 3, -5]} intensity={0.95} color="#dce7f5" />
      <pointLight position={[0, 1.5, 4.5]} intensity={1.15} color="#ffe8c8" />
      <pointLight position={[0, -2.5, -2.5]} intensity={0.55} color="#ffd7a3" />

      {/* 360° Smooth Damped OrbitControls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={2.8}
        maxDistance={7.5}
        target={[0, 0.15, 0]}
        enableDamping={true}
        dampingFactor={0.06}
      />

      {/* Subtle Dark Walnut Studio Floor Pedestal Disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.65, 0]} receiveShadow>
        <circleGeometry args={[1.6, 48]} />
        <meshStandardMaterial color="#1a120d" roughness={0.75} metalness={0.08} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.645, 0]}>
        <ringGeometry args={[1.56, 1.6, 48]} />
        <meshStandardMaterial color="#c9a35b" roughness={0.28} metalness={0.82} />
      </mesh>

      <group ref={groupRef} position={[0, 0, 0]}>
        <ShirtModel
          shirt={shirt}
          position={[0, -0.15, 0]}
          rotation={[0, -0.22, 0]}
          isSelected={true}
        />
      </group>
    </>
  );
};
