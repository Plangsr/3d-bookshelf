'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Book } from '@/types/book';
import { createBookTextures } from './BookTextureGenerator';

interface BookModelProps {
  book: Book;
  position: [number, number, number];
  rotation?: [number, number, number];
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
}

export const BookModel: React.FC<BookModelProps> = ({
  book,
  position,
  rotation = [0, 0, 0],
  isSelected = false,
  isHovered = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) => {
  // Generate high quality canvas textures with cloth weave & gold/silver foil motifs
  const textures = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return createBookTextures(book.title, book.author, book.spineText, book.color, book.foilColor);
  }, [book.title, book.author, book.spineText, book.color, book.foilColor]);

  // Page edge off-white cream material
  const pagesMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#f5f0e6',
      roughness: 0.9,
      metalness: 0.05,
    });
  }, []);

  const clothMaterials = useMemo(() => {
    if (!textures) {
      return new THREE.MeshStandardMaterial({ color: book.color });
    }

    // Material setup:
    // BoxGeometry Face index:
    // 0: Right (Page edge), 1: Left (Spine), 2: Top (Page edge), 3: Bottom (Page edge), 4: Front Cover, 5: Back Cover
    const spineMat = new THREE.MeshStandardMaterial({
      map: textures.spineTexture,
      roughness: 0.65,
      metalness: 0.25,
    });

    const frontMat = new THREE.MeshStandardMaterial({
      map: textures.frontTexture,
      roughness: 0.65,
      metalness: 0.25,
    });

    const backMat = new THREE.MeshStandardMaterial({
      map: textures.backTexture,
      roughness: 0.65,
      metalness: 0.25,
    });

    return [
      pagesMaterial, // 0: Right (cut pages)
      spineMat,      // 1: Left (spine)
      pagesMaterial, // 2: Top (cut pages)
      pagesMaterial, // 3: Bottom (cut pages)
      frontMat,      // 4: Front
      backMat,       // 5: Back
    ];
  }, [textures, book.color, pagesMaterial]);

  // If hovered on shelf, slight pull out
  const targetY = isHovered && !isSelected ? position[1] + 0.15 : position[1];
  const targetZ = isHovered && !isSelected ? position[2] + 0.35 : position[2];

  return (
    <group
      position={[position[0], targetY, targetZ]}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        onPointerOver?.();
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
        onPointerOut?.();
      }}
    >
      {/* Main hardcover body */}
      <mesh
        castShadow
        receiveShadow
        material={clothMaterials}
      >
        <boxGeometry args={[book.width, book.height, book.depth]} />
      </mesh>
    </group>
  );
};
