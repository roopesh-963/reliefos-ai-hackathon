import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useScenePerformance } from '../../hooks/useScenePerformance';
import { BlackHole } from '../BlackHole';
import { FuturisticCity } from '../FuturisticCity';

interface CinematicModelSceneProps {
  modelPath?: string | null;
}

function ModelAsset({ path }: { path: string }) {
  const gltf = useGLTF(path);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  return <primitive object={scene} scale={2.5} />;
}

function LandingLikeFallback({ lowPower }: { lowPower: boolean }) {
  const shellRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.elapsedTime;

    if (shellRef.current) {
      shellRef.current.rotation.y += delta * 0.12;
      shellRef.current.rotation.x = Math.sin(elapsed * 0.2) * 0.03;
    }

    if (ringsRef.current) {
      ringsRef.current.rotation.z += delta * 0.12;
      ringsRef.current.rotation.x = Math.cos(elapsed * 0.18) * 0.08;
    }
  });

  return (
    <group scale={[1.78, 1.78, 1.78]}>
      <group ref={shellRef}>
        <BlackHole lowPower={lowPower} />
      </group>

      <group ref={ringsRef} position={[0, 0.1, 0]}>
        <FuturisticCity progress={1} lowPower={lowPower} />
      </group>

      <group position={[0, 0.65, 0]}>
        <mesh>
          <torusGeometry args={[6.8, 0.09, 32, 220]} />
          <meshStandardMaterial color="#7ae0ff" emissive="#48a7ff" emissiveIntensity={1.15} transparent opacity={0.58} />
        </mesh>
        <mesh rotation={[Math.PI / 2.8, Math.PI / 5, 0]}>
          <torusGeometry args={[8.2, 0.05, 32, 220]} />
          <meshStandardMaterial color="#ffd27a" emissive="#ff7b34" emissiveIntensity={0.82} transparent opacity={0.45} />
        </mesh>
        <mesh position={[0, -3.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[12, 64]} />
          <meshBasicMaterial color="#52b7ff" transparent opacity={0.12} />
        </mesh>
      </group>
    </group>
  );
}

function SceneContent({
  modelPath,
  interactive,
  isPageVisible,
  lowPower,
}: {
  modelPath?: string | null;
  interactive: boolean;
  isPageVisible: boolean;
  lowPower: boolean;
}) {
  const rigRef = useRef<THREE.Group>(null);
  const targetRotation = useRef({ x: 0, y: 0 });
  const targetPosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!interactive) {
      targetRotation.current = { x: 0, y: 0 };
      targetPosition.current = { x: 0, y: 0 };
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const normalizedX = event.clientX / window.innerWidth - 0.5;
      const normalizedY = event.clientY / window.innerHeight - 0.5;

      targetRotation.current = {
        x: normalizedY * -0.14,
        y: normalizedX * 0.28,
      };
      targetPosition.current = {
        x: normalizedX * 0.42,
        y: normalizedY * -0.18,
      };
    };

    const resetPointer = () => {
      targetRotation.current = { x: 0, y: 0 };
      targetPosition.current = { x: 0, y: 0 };
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerleave', resetPointer);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', resetPointer);
    };
  }, [interactive]);

  useFrame(({ clock }, delta) => {
    if (!rigRef.current || !isPageVisible) {
      return;
    }

    const floatOffset = Math.sin(clock.elapsedTime * 0.45) * 0.12;
    const hasModel = Boolean(modelPath);

    rigRef.current.rotation.x = THREE.MathUtils.damp(
      rigRef.current.rotation.x,
      targetRotation.current.x + floatOffset * 0.08,
      4,
      delta
    );
    rigRef.current.rotation.y = THREE.MathUtils.damp(
      rigRef.current.rotation.y,
      targetRotation.current.y + Math.sin(clock.elapsedTime * 0.18) * 0.06,
      4,
      delta
    );
    rigRef.current.position.x = THREE.MathUtils.damp(
      rigRef.current.position.x,
      hasModel ? 2.15 + targetPosition.current.x * 1.1 : 1.7 + targetPosition.current.x * 0.9,
      3.5,
      delta
    );
    rigRef.current.position.y = THREE.MathUtils.damp(
      rigRef.current.position.y,
      hasModel ? 0.35 + targetPosition.current.y + floatOffset : 0.05 + targetPosition.current.y * 0.5 + floatOffset,
      3.5,
      delta
    );
  });

  return (
    <>
      <fog attach="fog" args={['#02050b', 8, 24]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 4, 6]} intensity={2.5} color="#d1f2ff" />
      <pointLight position={[-4, -2, 2]} intensity={3.1} color="#ff7e47" />
      <pointLight position={[3, 1, -2]} intensity={2.3} color="#52b7ff" />

      <group ref={rigRef} position={modelPath ? [2.15, 0.35, 0] : [1.7, 0.05, 0]}>
        <Float speed={0.62} rotationIntensity={0.14} floatIntensity={modelPath ? 0.24 : 0.18}>
          <group scale={modelPath ? [1.04, 1.04, 1.04] : [1.08, 1.08, 1.08]}>
            {modelPath ? <ModelAsset path={modelPath} /> : <LandingLikeFallback lowPower={lowPower} />}
          </group>
        </Float>
      </group>

      <mesh position={[1.5, -3.6, -0.8]} rotation={[-Math.PI / 2, 0, 0]} scale={[18, 18, 1]}>
        <circleGeometry args={[1, 64]} />
        <meshBasicMaterial color="#4ed8ff" transparent opacity={0.2} />
      </mesh>
    </>
  );
}

export default function CinematicModelScene({ modelPath }: CinematicModelSceneProps) {
  const { dpr, isLowPower, isPageVisible } = useScenePerformance();

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0.3, 0.55, 7.4], fov: 38 }}
      frameloop={isPageVisible ? 'always' : 'never'}
      className="h-full w-full"
    >
      <Suspense fallback={null}>
        <SceneContent
          modelPath={modelPath}
          interactive={!isLowPower}
          isPageVisible={isPageVisible}
          lowPower={isLowPower}
        />
      </Suspense>
    </Canvas>
  );
}
