'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Book } from '@/types/book';
import { BookModel } from './BookModel';

interface InspectionViewProps {
  book: Book;
  onClose: () => void;
  onOpenReader: (book: Book) => void;
}

export const InspectionView: React.FC<InspectionViewProps> = ({
  book,
  onClose,
  onOpenReader,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  // Subtle floating idle motion
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.05;
    }
  });

  return (
    <>
      {/* Dedicated studio lighting for inspecting textures, foil reflection, and cloth weave */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 5]} intensity={1.8} castShadow color="#fffbf5" />
      <directionalLight position={[-5, -4, -4]} intensity={0.6} color="#e0e8f0" />
      <pointLight position={[0, 0, 4]} intensity={1.2} color="#fff4df" />

      {/* OrbitControls with damping for smooth feel */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        minDistance={2.5}
        maxDistance={7}
        enableDamping={true}
        dampingFactor={0.05}
      />

      <group ref={groupRef} position={[0, 0, 0]}>
        {/* Render book centered and facing front */}
        <BookModel
          book={book}
          position={[0, 0, 0]}
          rotation={[0, -Math.PI / 6, 0]} // Slight tilt to reveal spine and front cover
          isSelected={true}
        />
      </group>
    </>
  );
};
