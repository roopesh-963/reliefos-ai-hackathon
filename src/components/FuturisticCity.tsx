import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Float } from '@react-three/drei';

interface BuildingProps {
  position: [number, number, number];
  height: number;
  width: number;
  depth: number;
  delay: number;
  speed: number;
  assemblyOffset: number;
  progress: number;
}

const Building = memo(function Building({
  position,
  height,
  width,
  depth,
  progress,
  assemblyOffset,
}: BuildingProps) {
  const meshRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const windowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const warningLightRef = useRef<THREE.Mesh>(null);
  const flickerSeed = useMemo(() => Math.random() * 10, []);

  const details = useMemo(() => {
    const hasAntenna = Math.random() > 0.4;
    const hasBalconies = Math.random() > 0.5;
    const antennaHeight = 0.5 + Math.random() * 2.0;
    const balconyCount = Math.floor(Math.random() * 4) + 1;
    const panelColor = Math.random() > 0.5 ? '#2a2a2a' : '#111111';
    const twistStrength = (Math.random() - 0.5) * Math.PI * 2;
    const unfoldingStyle = Math.random() > 0.5 ? 'expand' : 'rise';
    const tierCount = Math.floor(Math.random() * 3) + 1;
    const shapeType = Math.random() > 0.8 ? 'cylinder' : 'box';
    const hasNeonStrip = Math.random() > 0.3;
    const neonColor = Math.random() > 0.7 ? '#ff4d00' : '#00a2ff';
    const hasPipe = Math.random() > 0.5;
    const pipeOffset = (Math.random() - 0.5) * 2;
    const hasTopStructure = Math.random() > 0.6;
    const hasSatelliteDish = Math.random() > 0.7;
    const satelliteAngle = Math.random() * Math.PI * 2;
    const hasWarningLight = Math.random() > 0.5 && height > 3;
    const facadePattern = Math.random() > 0.5 ? 'grid' : 'strips';

    const balconies = [...Array(balconyCount)].map((_, index) => ({
      id: `balcony-${index}`,
      y: (index - balconyCount / 2) * (height / (balconyCount + 1)),
      z: (Math.random() - 0.5) * (depth * 0.6),
    }));

    return {
      hasAntenna,
      hasBalconies,
      antennaHeight,
      balconyCount,
      panelColor,
      twistStrength,
      unfoldingStyle,
      tierCount,
      shapeType,
      hasNeonStrip,
      neonColor,
      hasPipe,
      pipeOffset,
      hasTopStructure,
      hasSatelliteDish,
      satelliteAngle,
      hasWarningLight,
      facadePattern,
      balconies,
    };
  }, [depth, height]);

  const tierHeight = useMemo(() => height / details.tierCount, [details.tierCount, height]);
  const tiers = useMemo(
    () =>
      [...Array(details.tierCount)].map((_, index) => {
        const scale = 1 - index * 0.15;
        const offset = (index - (details.tierCount - 1) / 2) * tierHeight;
        return { id: `tier-${index}`, scale, offset };
      }),
    [details.tierCount, tierHeight]
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const heightProgress = Math.pow(progress, 1.5 + assemblyOffset);
    const horizontalScale = details.unfoldingStyle === 'expand' ? Math.min(1, progress * 1.5) : 1;
    const yPos = position[1] + progress * 8 - 4.5;

    if (meshRef.current) {
      meshRef.current.position.y = yPos + Math.sin(time + position[0]) * 0.1 * progress;
      meshRef.current.rotation.y = (1 - progress) * details.twistStrength + Math.sin(time * 0.5 + position[2]) * 0.05 * progress;
      meshRef.current.scale.set(horizontalScale, Math.max(heightProgress, 0.001), horizontalScale);
      meshRef.current.visible = progress > 0.02;
    }

    const pulse = Math.sin(time * 3 + flickerSeed) * 0.15 + 0.85;
    const flicker = Math.sin(time * 30 + flickerSeed) * Math.sin(time * 20) > 0.4 ? 1.1 : 0.8;
    const intensity = progress * pulse * flicker;

    if (materialRef.current) {
      materialRef.current.emissiveIntensity = intensity * 2;
    }

    if (windowMaterialRef.current) {
      windowMaterialRef.current.opacity = (details.facadePattern === 'grid' ? 0.4 : 0.2) * intensity;
    }

    if (warningLightRef.current) {
      (warningLightRef.current.material as THREE.MeshBasicMaterial).opacity =
        (Math.sin(time * 5.0) > 0 ? 1 : 0) * progress;
    }
  });

  return (
    <group ref={meshRef} position={[position[0], -4.5, position[2]]}>
      {tiers.map((tier, index) => (
        <mesh key={tier.id} position={[0, tier.offset, 0]} frustumCulled>
          {details.shapeType === 'box' ? (
            <boxGeometry args={[width * tier.scale, tierHeight, depth * tier.scale]} />
          ) : (
            <cylinderGeometry args={[width * tier.scale / 2, width * tier.scale / 2, tierHeight, 12]} />
          )}
          <meshStandardMaterial
            ref={index === 0 ? materialRef : undefined}
            color="#1a1a1a"
            emissive={details.neonColor}
            emissiveIntensity={0}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      ))}

      {[0.2, 0.4, 0.6, 0.8].map((value, index) => (
        <mesh key={`panel-${index}`} position={[0, (value - 0.5) * height, 0]} frustumCulled>
          <boxGeometry args={[width * 1.05, 0.02, depth * 1.05]} />
          <meshStandardMaterial
            color={details.panelColor}
            metalness={index % 2 === 0 ? 1 : 0.7}
            roughness={index % 2 === 0 ? 0 : 0.3}
          />
        </mesh>
      ))}

      {details.hasNeonStrip && (
        <mesh position={[width / 2 + 0.01, 0, 0]} frustumCulled>
          <boxGeometry args={[0.02, height, 0.05]} />
          <meshBasicMaterial color={details.neonColor} transparent opacity={0.6 * progress} />
        </mesh>
      )}

      {details.hasPipe && (
        <mesh position={[details.pipeOffset * (width / 2.2), 0, depth / 2 + 0.05]} frustumCulled>
          <cylinderGeometry args={[0.03, 0.03, height, 8]} />
          <meshStandardMaterial color="#444" metalness={0.9} roughness={0.1} />
        </mesh>
      )}

      <mesh position={[0, 0, 0]} frustumCulled>
        <boxGeometry args={[width * 1.01, height + 0.01, depth * 1.01]} />
        <meshBasicMaterial
          ref={windowMaterialRef}
          color={details.neonColor}
          wireframe={details.facadePattern === 'grid'}
          transparent
          opacity={0}
        />
      </mesh>

      <group position={[0, height / 2, 0]}>
        {details.hasAntenna && (
          <mesh position={[0, details.antennaHeight / 2, 0]} frustumCulled>
            <boxGeometry args={[0.015, details.antennaHeight, 0.015]} />
            <meshBasicMaterial color={details.neonColor} />
          </mesh>
        )}

        {details.hasSatelliteDish && (
          <group position={[width * 0.2, 0.1, depth * 0.2]} rotation={[0.5, details.satelliteAngle, 0]}>
            <mesh frustumCulled>
              <sphereGeometry args={[0.15, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#333" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.1, 0]} frustumCulled>
              <cylinderGeometry args={[0.01, 0.01, 0.2, 8]} />
              <meshBasicMaterial color={details.neonColor} />
            </mesh>
          </group>
        )}

        {details.hasWarningLight && (
          <mesh ref={warningLightRef} position={[0, 0.1, 0]} frustumCulled>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0} />
          </mesh>
        )}

        {details.hasTopStructure && (
          <mesh position={[0, 0.1, 0]} frustumCulled>
            <boxGeometry args={[width * 0.7, 0.2, depth * 0.7]} />
            <meshStandardMaterial color="#222" metalness={1} />
          </mesh>
        )}
      </group>

      {details.hasBalconies &&
        details.balconies.map((balcony) => (
          <mesh key={balcony.id} position={[width / 2.1, balcony.y, balcony.z]} frustumCulled>
            <boxGeometry args={[0.3, 0.02, depth * 0.4]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.9} />
          </mesh>
        ))}
    </group>
  );
});

function Satellite({
  radius,
  speed,
  offset,
  color,
}: {
  radius: number;
  speed: number;
  offset: number;
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + offset;
    if (meshRef.current) {
      meshRef.current.position.x = Math.cos(t) * radius;
      meshRef.current.position.z = Math.sin(t) * radius;
      meshRef.current.position.y = Math.sin(t * 0.5) * (radius * 0.2);
    }
  });

  return (
    <Float speed={1.4} rotationIntensity={0.6} floatIntensity={0.75}>
      <group>
        <mesh ref={meshRef} frustumCulled>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
        </mesh>
        <mesh scale={1.8} frustumCulled>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.18} />
        </mesh>
      </group>
    </Float>
  );
}

const hologramShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#00a2ff') },
    uOpacity: { value: 0.6 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;
      vec2 grid = fract(uv * vec2(10.0, 20.0));
      float line = step(0.95, grid.x) + step(0.95, grid.y);
      vec2 ipos = floor(uv * vec2(10.0, 20.0));
      float flicker = step(0.7, random(ipos + floor(uTime * 10.0)));
      float scan = step(0.98, fract(uv.y - uTime * 0.5));
      float finalAlpha = (flicker * 0.4 + line * 0.2 + scan * 0.5) * uOpacity;
      finalAlpha *= smoothstep(0.0, 0.1, uv.x) * smoothstep(1.0, 0.9, uv.x);
      finalAlpha *= smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);
      gl_FragColor = vec4(uColor, finalAlpha);
    }
  `,
};

const HologramPanel = memo(function HologramPanel({
  position,
  rotation,
  scale,
  progress,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  progress: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <group position={position} rotation={rotation} scale={scale} visible={progress > 0.4}>
      <mesh frustumCulled>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={materialRef}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          {...hologramShader}
        />
      </mesh>
      <mesh frustumCulled>
        <planeGeometry args={[1.05, 1.05]} />
        <meshBasicMaterial color="#00a2ff" wireframe transparent opacity={0.2 * progress} />
      </mesh>
    </group>
  );
});

export const FuturisticCity = memo(function FuturisticCity({
  progress,
  lowPower = false,
}: {
  progress: number;
  lowPower?: boolean;
}) {
  const buildingCount = lowPower ? 28 : 45;
  const hologramCount = lowPower ? 7 : 12;
  const satelliteCount = lowPower ? 5 : 8;

  const buildings = useMemo(() => {
    return [...Array(buildingCount)].map(() => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.5 + Math.random() * 5;
      return {
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number],
        height: 1.5 + Math.random() * 4,
        width: 0.3 + Math.random() * 0.6,
        depth: 0.3 + Math.random() * 0.6,
        delay: Math.random() * 0.6,
        speed: 1.5 + Math.random() * 2.5,
        assemblyOffset: Math.random() * 0.5,
      };
    });
  }, [buildingCount]);

  const holograms = useMemo(() => {
    return [...Array(hologramCount)].map(() => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 3;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      return {
        position: [x, 2 + Math.random() * 4, z] as [number, number, number],
        rotation: [0, -angle + Math.PI / 2, 0] as [number, number, number],
        scale: [1 + Math.random() * 2, 0.5 + Math.random() * 1.5, 1] as [number, number, number],
      };
    });
  }, [hologramCount]);

  const satellites = useMemo(
    () =>
      [...Array(satelliteCount)].map((_, index) => ({
        id: `satellite-${index}`,
        radius: 6 + Math.random() * 4,
        speed: 0.2 + Math.random() * 0.3,
        offset: Math.random() * Math.PI * 2,
        color: index % 2 === 0 ? '#00a2ff' : '#ff4d00',
      })),
    [satelliteCount]
  );

  return (
    <group>
      {buildings.map((building, index) => {
        const buildingProgress = Math.max(0, Math.min(1, (progress - building.delay) * building.speed));
        return <Building key={`building-${index}`} {...building} progress={buildingProgress} />;
      })}

      {holograms.map((hologram, index) => (
        <Float key={`hologram-${index}`} speed={1.1} rotationIntensity={0.16} floatIntensity={0.4}>
          <HologramPanel {...hologram} progress={progress} />
        </Float>
      ))}

      <Float speed={1.6} rotationIntensity={0.16} floatIntensity={0.45}>
        <Building
          position={[0, 0, 0]}
          height={7}
          width={1.2}
          depth={1.2}
          progress={progress}
          delay={0}
          speed={1}
          assemblyOffset={0}
        />
        <mesh position={[0, progress * 8 - 1, 0]} frustumCulled>
          <sphereGeometry args={[5.5, lowPower ? 18 : 24, lowPower ? 18 : 24]} />
          <meshBasicMaterial color="#00a2ff" transparent opacity={0.12 * progress} wireframe />
        </mesh>
      </Float>

      {progress > 0.3 && (
        <group>
          {satellites.map((satellite) => (
            <Satellite
              key={satellite.id}
              radius={satellite.radius}
              speed={satellite.speed}
              offset={satellite.offset}
              color={satellite.color}
            />
          ))}
        </group>
      )}
    </group>
  );
});
