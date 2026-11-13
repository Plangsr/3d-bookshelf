'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Shirt, ShirtStyle } from '@/types/shirt';
import { createShirtTextures } from './ShirtTextureGenerator';

interface ShirtModelProps {
  shirt: Shirt;
  position: [number, number, number];
  rotation?: [number, number, number];
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
}

const torsoGeoCache = new Map<ShirtStyle, THREE.BufferGeometry>();
const hookGeoCache: { geo: THREE.TubeGeometry | null } = { geo: null };

/**
 * Builds and caches a sculpted garment torso geometry with sloped shoulders,
 * chest contour, subtle waist taper, neck opening depression, and natural vertical fabric drape.
 * Preserves BoxGeometry material groups (4 = Front, 5 = Back, 0/1/2/3 = Sides/Edges).
 */
function getSculptedTorsoGeometry(style: ShirtStyle): THREE.BufferGeometry {
  if (torsoGeoCache.has(style)) {
    return torsoGeoCache.get(style)!;
  }

  const width = style === 'hoodie' ? 1.18 : style === 'oxford' ? 1.08 : 1.06;
  const height = style === 'hoodie' ? 1.82 : style === 'oxford' ? 1.78 : 1.72;
  const depth = style === 'hoodie' ? 0.34 : style === 'oxford' ? 0.25 : 0.24;

  const geo = new THREE.BoxGeometry(width, height, depth, 14, 18, 4);
  const pos = geo.attributes.position;
  const halfW = width / 2;
  const halfH = height / 2;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const ny = (y + halfH) / height; // 0 (hem) -> 1 (shoulder top)
    const nx = x / halfW; // -1 (left) -> +1 (right)
    const absX = Math.abs(nx);

    // 1. Waist & hip tailoring silhouette
    let widthScale = 1.0;
    if (style === 'oxford') {
      widthScale = 0.94 + 0.08 * Math.pow(ny - 0.32, 2) + 0.04 * ny;
    } else if (style === 'hoodie') {
      widthScale = 1.0 + 0.05 * Math.sin(ny * Math.PI);
      if (ny < 0.12) widthScale *= 0.94; // ribbed hem cinch
    } else {
      widthScale = 0.96 + 0.06 * ny;
    }
    x *= widthScale;

    // 2. Shoulder slope matching wooden hanger arms (downward slope outward)
    if (ny > 0.82 && absX > 0.22) {
      const shoulderFactor = (ny - 0.82) / 0.18;
      const edgeFactor = (absX - 0.22) / 0.78;
      y -= shoulderFactor * edgeFactor * 0.22;
    }

    // 3. Center neckline scoop so collar & wooden hanger neck sit naturally
    if (ny > 0.88 && absX < 0.34) {
      const neckFactor = (ny - 0.88) / 0.12;
      const centerWeight = Math.cos((absX / 0.34) * (Math.PI / 2));
      const scoopDepth = style === 'tshirt' ? 0.14 : style === 'hoodie' ? 0.09 : 0.11;
      y -= neckFactor * centerWeight * scoopDepth;
    }

    // 4. Natural rounded chest depth + subtle vertical cloth drape folds toward hem
    const edgeRoundness = Math.sqrt(Math.max(0.15, 1 - Math.pow(absX, 2.2) * 0.65));
    const chestFullness = 0.88 + 0.24 * Math.sin(ny * Math.PI * 0.85);
    const drapeWave = Math.sin(nx * Math.PI * 3) * 0.022 * (1 - ny * 0.85);

    z = z * edgeRoundness * chestFullness + (z >= 0 ? drapeWave : -drapeWave * 0.5);

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  torsoGeoCache.set(style, geo);
  return geo;
}

/**
 * Builds a smooth curved brass hanger hook whose top arch centers at local (0, 1.70, 0)
 * so it wraps cleanly over the WardrobeRack brass rail at y = 4.35 when ShirtModel sits at y = 2.65.
 */
function getBrassHookGeometry(): THREE.TubeGeometry {
  if (hookGeoCache.geo) return hookGeoCache.geo;

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.08, 0),
    new THREE.Vector3(0, 1.56, 0),
    new THREE.Vector3(0, 1.69, -0.045),
    new THREE.Vector3(0, 1.78, 0.005),
    new THREE.Vector3(0, 1.755, 0.072),
    new THREE.Vector3(0, 1.665, 0.09),
    new THREE.Vector3(0, 1.6, 0.055),
  ]);

  const geo = new THREE.TubeGeometry(curve, 28, 0.02, 10, false);
  hookGeoCache.geo = geo;
  return geo;
}

/**
 * 3D Hanging Garment on a sculpted oiled-walnut & brushed-brass boutique coat hanger.
 * Supports t-shirt, polo, oxford button-down, and hoodie silhouettes with tailored collars,
 * angled sleeves, and tactile hover animation.
 */
export const ShirtModel: React.FC<ShirtModelProps> = ({
  shirt,
  position,
  rotation = [0, 0, 0],
  isSelected = false,
  isHovered = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) => {
  const animatedGroupRef = useRef<THREE.Group>(null);
  const style: ShirtStyle = shirt.style || 'tshirt';
  const isLongSleeve = style === 'oxford' || style === 'hoodie';

  const textures = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return createShirtTextures(
      shirt.name,
      shirt.sku,
      shirt.brandOrCollection || shirt.category,
      shirt.color,
      shirt.accentColor || '#e8c170',
      style,
      shirt.tagText,
      shirt.frontImageUrl,
      shirt.backImageUrl
    );
  }, [
    shirt.name,
    shirt.sku,
    shirt.brandOrCollection,
    shirt.category,
    shirt.color,
    shirt.accentColor,
    style,
    shirt.tagText,
    shirt.frontImageUrl,
    shirt.backImageUrl,
  ]);

  const torsoGeometry = useMemo(() => getSculptedTorsoGeometry(style), [style]);
  const hookGeometry = useMemo(() => getBrassHookGeometry(), []);

  // Materials for sculpted torso (BoxGeometry face indices: 0,1,2,3 = edges, 4 = front, 5 = back)
  const torsoMaterials = useMemo(() => {
    const roughness = style === 'hoodie' ? 0.88 : style === 'polo' ? 0.82 : 0.76;
    const edgeMat = new THREE.MeshStandardMaterial({
      color: shirt.color,
      roughness,
      metalness: 0.04,
    });

    if (!textures) return edgeMat;

    const frontMat = new THREE.MeshStandardMaterial({
      map: textures.frontTexture,
      roughness,
      metalness: 0.04,
    });
    const backMat = new THREE.MeshStandardMaterial({
      map: textures.backTexture,
      roughness,
      metalness: 0.04,
    });

    return [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat];
  }, [textures, shirt.color, style]);

  const sleeveMaterial = useMemo(() => {
    const roughness = style === 'hoodie' ? 0.88 : 0.78;
    if (!textures) {
      return new THREE.MeshStandardMaterial({ color: shirt.color, roughness, metalness: 0.04 });
    }
    return new THREE.MeshStandardMaterial({
      map: textures.sleeveTexture,
      roughness,
      metalness: 0.04,
    });
  }, [textures, shirt.color, style]);

  const fabricTrimMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: shirt.color,
      roughness: 0.78,
      metalness: 0.04,
    });
  }, [shirt.color]);

  const accentMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: shirt.accentColor || '#e8c170',
      roughness: 0.55,
      metalness: 0.15,
    });
  }, [shirt.accentColor]);

  const buttonMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#f2eadc',
      roughness: 0.3,
      metalness: 0.15,
    });
  }, []);

  const woodHangerMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#4b2a17',
      roughness: 0.45,
      metalness: 0.08,
    });
  }, []);

  const brassMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#d4ae67',
      roughness: 0.24,
      metalness: 0.88,
    });
  }, []);

  // Smooth tactile hover pull & subtle garment swing
  useFrame((state, delta) => {
    const grp = animatedGroupRef.current;
    if (!grp) return;

    const damp = Math.min(1, delta * 9);
    const activeHover = isHovered && !isSelected;

    const targetZ = activeHover ? 0.42 : 0;
    const targetY = activeHover ? 0.08 : 0;
    const targetRotY = activeHover ? -rotation[1] * 0.65 + 0.08 : 0;
    const subtleSway = !isSelected
      ? Math.sin(state.clock.elapsedTime * 1.4 + position[0] * 0.8) * (activeHover ? 0.025 : 0.008)
      : 0;

    grp.position.z = THREE.MathUtils.lerp(grp.position.z, targetZ, damp);
    grp.position.y = THREE.MathUtils.lerp(grp.position.y, targetY, damp);
    grp.rotation.y = THREE.MathUtils.lerp(grp.rotation.y, targetRotY, damp);
    grp.rotation.z = THREE.MathUtils.lerp(grp.rotation.z, subtleSway, damp);
  });

  // Geometry metrics derived from style
  const shoulderX = style === 'hoodie' ? 0.54 : 0.49;
  const shoulderY = style === 'hoodie' ? 0.72 : 0.69;
  const sleeveLength = isLongSleeve ? 1.32 : 0.56;
  const sleeveTopR = style === 'hoodie' ? 0.165 : 0.145;
  const sleeveBotR = isLongSleeve ? (style === 'hoodie' ? 0.115 : 0.105) : 0.125;
  const sleeveAngle = isLongSleeve ? 0.34 : 0.48;
  const torsoFrontZ = style === 'hoodie' ? 0.165 : 0.122;

  return (
    <group
      position={position}
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
      <group ref={animatedGroupRef}>
        {/* 1. WOODEN & BRASS BOUTIQUE COAT HANGER */}
        <group>
          {/* Curved Brass Hook */}
          <mesh castShadow geometry={hookGeometry} material={brassMaterial} />

          {/* Brass Swivel Collar Nut */}
          <mesh position={[0, 1.07, 0]} material={brassMaterial}>
            <cylinderGeometry args={[0.042, 0.048, 0.08, 14]} />
          </mesh>

          {/* Center Walnut Hanger Neck Block */}
          <mesh castShadow position={[0, 0.99, 0]} material={woodHangerMaterial}>
            <boxGeometry args={[0.24, 0.12, 0.11]} />
          </mesh>

          {/* Left Sloped Walnut Shoulder Arm */}
          <mesh
            castShadow
            position={[-0.31, 0.91, 0]}
            rotation={[0, 0, 0.34]}
            material={woodHangerMaterial}
          >
            <boxGeometry args={[0.62, 0.085, 0.105]} />
          </mesh>

          {/* Right Sloped Walnut Shoulder Arm */}
          <mesh
            castShadow
            position={[0.31, 0.91, 0]}
            rotation={[0, 0, -0.34]}
            material={woodHangerMaterial}
          >
            <boxGeometry args={[0.62, 0.085, 0.105]} />
          </mesh>

          {/* Small Brass Hangtag on Hanger Neck */}
          <group position={[0.16, 0.96, 0.08]} rotation={[0, 0, -0.18]}>
            <mesh material={brassMaterial} position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.08, 8]} />
            </mesh>
            <mesh castShadow material={accentMaterial} position={[0, -0.05, 0]}>
              <boxGeometry args={[0.11, 0.15, 0.014]} />
            </mesh>
          </group>
        </group>

        {/* 2. SCULPTED GARMENT TORSO */}
        <mesh castShadow receiveShadow geometry={torsoGeometry} material={torsoMaterials} />

        {/* Ribbed Waistband for Hoodie */}
        {style === 'hoodie' && (
          <mesh castShadow receiveShadow position={[0, -0.84, 0]} material={fabricTrimMaterial}>
            <boxGeometry args={[1.11, 0.16, 0.31]} />
          </mesh>
        )}

        {/* 3. LEFT & RIGHT ANGLED SLEEVES (Natural Gravity Drape) */}
        {/* Left Sleeve */}
        <group position={[-shoulderX, shoulderY, 0]} rotation={[0.04, 0, -sleeveAngle]}>
          <mesh
            castShadow
            receiveShadow
            position={[0, -sleeveLength / 2, 0]}
            scale={[1, 1, 0.68]}
            material={sleeveMaterial}
          >
            <cylinderGeometry args={[sleeveTopR, sleeveBotR, sleeveLength, 16]} />
          </mesh>
          {/* Sleeve Cuff Detail */}
          <mesh
            castShadow
            position={[0, -sleeveLength + 0.035, 0]}
            scale={[1, 1, 0.7]}
            material={fabricTrimMaterial}
          >
            <cylinderGeometry args={[sleeveBotR * 1.03, sleeveBotR * 0.98, 0.08, 16]} />
          </mesh>
          {style === 'oxford' && (
            <mesh position={[0, -sleeveLength + 0.04, sleeveBotR * 0.72]} material={buttonMaterial}>
              <cylinderGeometry args={[0.015, 0.015, 0.014, 10]} />
            </mesh>
          )}
        </group>

        {/* Right Sleeve */}
        <group position={[shoulderX, shoulderY, 0]} rotation={[0.04, 0, sleeveAngle]}>
          <mesh
            castShadow
            receiveShadow
            position={[0, -sleeveLength / 2, 0]}
            scale={[1, 1, 0.68]}
            material={sleeveMaterial}
          >
            <cylinderGeometry args={[sleeveTopR, sleeveBotR, sleeveLength, 16]} />
          </mesh>
          {/* Sleeve Cuff Detail */}
          <mesh
            castShadow
            position={[0, -sleeveLength + 0.035, 0]}
            scale={[1, 1, 0.7]}
            material={fabricTrimMaterial}
          >
            <cylinderGeometry args={[sleeveBotR * 1.03, sleeveBotR * 0.98, 0.08, 16]} />
          </mesh>
          {style === 'oxford' && (
            <mesh position={[0, -sleeveLength + 0.04, sleeveBotR * 0.72]} material={buttonMaterial}>
              <cylinderGeometry args={[0.015, 0.015, 0.014, 10]} />
            </mesh>
          )}
        </group>

        {/* 4. STYLE-SPECIFIC COLLAR, PLACKET, POCKET & HOOD DETAILS */}
        {style === 'tshirt' && (
          <group position={[0, 0.79, 0.01]}>
            {/* Ribbed Crew Neck Band */}
            <mesh
              castShadow
              rotation={[Math.PI / 2 + 0.16, 0, 0]}
              scale={[1.15, 0.78, 1]}
              material={fabricTrimMaterial}
            >
              <torusGeometry args={[0.175, 0.034, 12, 24]} />
            </mesh>
          </group>
        )}

        {style === 'polo' && (
          <group>
            {/* Collar Base */}
            <mesh
              castShadow
              position={[0, 0.83, 0]}
              rotation={[Math.PI / 2 + 0.15, 0, 0]}
              scale={[1.1, 0.8, 1]}
              material={fabricTrimMaterial}
            >
              <torusGeometry args={[0.18, 0.038, 10, 24]} />
            </mesh>
            {/* Left Folded Polo Collar Wing */}
            <mesh
              castShadow
              position={[-0.12, 0.77, 0.11]}
              rotation={[0.28, 0.2, 0.48]}
              material={fabricTrimMaterial}
            >
              <boxGeometry args={[0.2, 0.12, 0.028]} />
            </mesh>
            {/* Right Folded Polo Collar Wing */}
            <mesh
              castShadow
              position={[0.12, 0.77, 0.11]}
              rotation={[0.28, -0.2, -0.48]}
              material={fabricTrimMaterial}
            >
              <boxGeometry args={[0.2, 0.12, 0.028]} />
            </mesh>
            {/* Center Placket & 3 Buttons */}
            <mesh position={[0, 0.56, torsoFrontZ + 0.012]} material={fabricTrimMaterial}>
              <boxGeometry args={[0.11, 0.44, 0.025]} />
            </mesh>
            {[0.7, 0.58, 0.46].map((by, idx) => (
              <mesh
                key={`polo-btn-${idx}`}
                position={[0, by, torsoFrontZ + 0.028]}
                rotation={[Math.PI / 2, 0, 0]}
                material={buttonMaterial}
              >
                <cylinderGeometry args={[0.016, 0.016, 0.014, 12]} />
              </mesh>
            ))}
          </group>
        )}

        {style === 'oxford' && (
          <group>
            {/* Structured Collar Band */}
            <mesh
              castShadow
              position={[0, 0.86, -0.01]}
              scale={[1.05, 1, 0.82]}
              material={fabricTrimMaterial}
            >
              <cylinderGeometry args={[0.185, 0.2, 0.11, 20, 1, true]} />
            </mesh>
            {/* Left & Right Button-Down Collar Points */}
            <mesh
              castShadow
              position={[-0.11, 0.79, 0.125]}
              rotation={[0.3, 0.22, 0.55]}
              material={fabricTrimMaterial}
            >
              <boxGeometry args={[0.21, 0.13, 0.026]} />
            </mesh>
            <mesh
              castShadow
              position={[0.11, 0.79, 0.125]}
              rotation={[0.3, -0.22, -0.55]}
              material={fabricTrimMaterial}
            >
              <boxGeometry args={[0.21, 0.13, 0.026]} />
            </mesh>
            {/* Full-Length Center Placket */}
            <mesh position={[0, -0.02, torsoFrontZ + 0.012]} material={fabricTrimMaterial}>
              <boxGeometry args={[0.095, 1.56, 0.022]} />
            </mesh>
            {/* 6 Mother-of-Pearl Buttons */}
            {[0.74, 0.5, 0.26, 0.02, -0.22, -0.46].map((by, idx) => (
              <mesh
                key={`ox-btn-${idx}`}
                position={[0, by, torsoFrontZ + 0.027]}
                rotation={[Math.PI / 2, 0, 0]}
                material={buttonMaterial}
              >
                <cylinderGeometry args={[0.016, 0.016, 0.014, 12]} />
              </mesh>
            ))}
            {/* Tailored Left Chest Patch Pocket */}
            <mesh position={[0.24, 0.34, torsoFrontZ + 0.008]} material={fabricTrimMaterial}>
              <boxGeometry args={[0.21, 0.24, 0.018]} />
            </mesh>
          </group>
        )}

        {style === 'hoodie' && (
          <group>
            {/* Sculpted Hood Crown draped behind & around neck */}
            <mesh
              castShadow
              position={[0, 0.96, -0.14]}
              rotation={[-0.35, 0, 0]}
              scale={[1.05, 1.15, 0.92]}
              material={fabricTrimMaterial}
            >
              <sphereGeometry args={[0.28, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
            </mesh>
            {/* Front Hood Cowl Rim */}
            <mesh
              castShadow
              position={[0, 0.84, 0.05]}
              rotation={[Math.PI / 2 + 0.25, 0, 0]}
              scale={[1.15, 0.88, 1]}
              material={fabricTrimMaterial}
            >
              <torusGeometry args={[0.2, 0.058, 12, 24]} />
            </mesh>
            {/* Twin Drawcords with Brass Aglets */}
            {[-0.075, 0.075].map((dx, idx) => (
              <group key={`cord-${idx}`} position={[dx, 0.56, torsoFrontZ + 0.02]}>
                <mesh material={buttonMaterial}>
                  <cylinderGeometry args={[0.011, 0.011, 0.38, 8]} />
                </mesh>
                <mesh position={[0, -0.2, 0]} material={brassMaterial}>
                  <cylinderGeometry args={[0.013, 0.013, 0.04, 8]} />
                </mesh>
              </group>
            ))}
            {/* Raised Front Kangaroo Pocket */}
            <mesh castShadow position={[0, -0.42, torsoFrontZ + 0.012]} material={fabricTrimMaterial}>
              <boxGeometry args={[0.68, 0.38, 0.04]} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
};
