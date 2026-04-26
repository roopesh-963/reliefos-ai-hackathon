import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { CrisisMarker } from '../services/api';

interface SeismicGlobeProps {
  markers: CrisisMarker[];
  selectedMarkerId: string | null;
  onMarkerSelect: (marker: CrisisMarker) => void;
  speed: number;
}

const latLngToVector3 = (lat: number, lng: number, radius = 2.04) => {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
};

const markerColor = (type: CrisisMarker['type']) => {
  if (type === 'critical') {
    return '#ef4444';
  }
  if (type === 'warning') {
    return '#f97316';
  }
  return '#22d3ee';
};

function GlobeScene({ markers, selectedMarkerId, onMarkerSelect, speed }: SeismicGlobeProps) {
  const globeRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);

  const [earthMap, bumpMap, specularMap, cloudMap] = useTexture([
    'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
    'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg',
    'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg',
    'https://threejs.org/examples/textures/planets/earth_clouds_1024.png',
  ]);

  earthMap.colorSpace = THREE.SRGBColorSpace;
  earthMap.anisotropy = 8;
  specularMap.anisotropy = 4;
  bumpMap.anisotropy = 4;
  cloudMap.anisotropy = 4;
  cloudMap.colorSpace = THREE.SRGBColorSpace;

  useFrame((_state, delta) => {
    if (globeRef.current) {
      const rotationScale = Math.max(0.2, speed / 100);
      globeRef.current.rotation.y += delta * 0.16 * rotationScale;
    }

    if (glowRef.current) {
      glowRef.current.rotation.y -= delta * 0.06;
    }

    if (cloudRef.current) {
      cloudRef.current.rotation.y += delta * 0.02;
    }
  });

  const mappedMarkers = useMemo(() => {
    return markers.map((marker) => ({
      marker,
      point: latLngToVector3(marker.position[0], marker.position[1], 2.1),
    }));
  }, [markers]);

  const handleMarkerClick = (event: ThreeEvent<MouseEvent>, marker: CrisisMarker) => {
    event.stopPropagation();
    onMarkerSelect(marker);
  };

  return (
    <>
      <color attach="background" args={['#030b16']} />
      <fog attach="fog" args={['#030b16', 8, 16]} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 3, 5]} intensity={1.4} color="#89c2ff" />
      <pointLight position={[-6, -2, -4]} intensity={0.9} color="#1d4ed8" />

      <Stars radius={70} depth={40} count={1200} factor={3} saturation={0} fade speed={0.4} />

      <group ref={globeRef}>
        <mesh>
          <sphereGeometry args={[2, 72, 72]} />
          <meshPhongMaterial
            map={earthMap}
            bumpMap={bumpMap}
            bumpScale={0.08}
            specularMap={specularMap}
            specular={new THREE.Color('#8bb3ff')}
            shininess={22}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[2.01, 56, 56]} />
          <meshBasicMaterial color="#1e3a8a" wireframe transparent opacity={0.35} />
        </mesh>

        <mesh ref={cloudRef}>
          <sphereGeometry args={[2.045, 64, 64]} />
          <meshPhongMaterial
            map={cloudMap}
            transparent
            opacity={0.28}
            depthWrite={false}
          />
        </mesh>

        <mesh ref={glowRef}>
          <sphereGeometry args={[2.2, 48, 48]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.08} side={THREE.BackSide} />
        </mesh>

        {mappedMarkers.map(({ marker, point }) => {
          const active = marker.id === selectedMarkerId;
          const color = markerColor(marker.type);
          const markerSize = active ? 0.07 : 0.048;
          const haloSize = active ? 0.16 : 0.12;

          return (
            <group key={marker.id} position={point.toArray()}>
              <mesh
                onClick={(event) => handleMarkerClick(event, marker)}
                onPointerOver={(event) => {
                  event.stopPropagation();
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                  document.body.style.cursor = 'default';
                }}
              >
                <sphereGeometry args={[markerSize, 16, 16]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 1.8 : 0.8} />
              </mesh>

              <mesh>
                <sphereGeometry args={[haloSize, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={active ? 0.24 : 0.12} />
              </mesh>
            </group>
          );
        })}
      </group>

      <OrbitControls enablePan={false} minDistance={3.7} maxDistance={7.5} />
    </>
  );
}

export function SeismicGlobe(props: SeismicGlobeProps) {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0.7, 5.2], fov: 45 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <GlobeScene {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
