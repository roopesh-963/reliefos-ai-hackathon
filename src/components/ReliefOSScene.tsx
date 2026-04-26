import { lazy, memo, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, type Frameloop, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Scroll, ScrollControls, useScroll } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { UIOverlay } from './UIOverlay';
import { useScenePerformance } from '../hooks/useScenePerformance';

const SpaceEnvironment = lazy(() => import('./SpaceEnvironment').then((module) => ({ default: module.SpaceEnvironment })));
const BlackHole = lazy(() => import('./BlackHole').then((module) => ({ default: module.BlackHole })));

const preloadLandingScene = () =>
  Promise.all([
    import('./SpaceEnvironment'),
    import('./BlackHole'),
  ]);

const SceneLoader = memo(function SceneLoader() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
      <div className="w-full max-w-xl px-6 text-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-[10px] uppercase tracking-[0.32em] text-cyan-100">
          ReliefOS AI
        </div>
        <div className="mt-6 text-5xl font-display font-bold tracking-tight text-white sm:text-6xl">
          Initializing Command Horizon
        </div>
        <div className="mt-4 text-sm text-gray-400 sm:text-base">
          Streaming the cinematic 3D layer while keeping the interface responsive.
        </div>
        <div className="mt-8 overflow-hidden rounded-full border border-white/10 bg-white/5">
          <div className="h-2 w-full animate-[shimmer_1.8s_linear_infinite] bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.75),transparent)]" />
        </div>
      </div>
    </div>
  );
});

function SceneContent({
  navigate,
  isLowPower,
  onSceneReady,
}: {
  navigate: (path: string) => void;
  isLowPower: boolean;
  onSceneReady: () => void;
}) {
  const scroll = useScroll();
  const [uiProgress, setUiProgress] = useState(0);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const sceneGroupRef = useRef<THREE.Group>(null);
  const lastUiSyncRef = useRef(0);
  const hasMarkedReadyRef = useRef(false);

  useFrame((state, delta) => {
    const nextProgress = scroll.offset;

    if (cameraRef.current) {
      cameraRef.current.position.z = THREE.MathUtils.damp(
        cameraRef.current.position.z,
        15 - nextProgress * 10,
        isLowPower ? 5 : 7,
        delta
      );
    }

    if (sceneGroupRef.current) {
      sceneGroupRef.current.rotation.y = THREE.MathUtils.damp(
        sceneGroupRef.current.rotation.y,
        nextProgress * Math.PI,
        isLowPower ? 4 : 6,
        delta
      );
    }

    const elapsed = state.clock.elapsedTime;
    const minUiInterval = isLowPower ? 1 / 12 : 1 / 18;
    if (Math.abs(uiProgress - nextProgress) > 0.015 && elapsed - lastUiSyncRef.current > minUiInterval) {
      lastUiSyncRef.current = elapsed;
      setUiProgress(nextProgress);
    }

    if (!hasMarkedReadyRef.current) {
      hasMarkedReadyRef.current = true;
      onSceneReady();
    }
  });

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={[0, 0, 15]}
        fov={75}
      />

      <group ref={sceneGroupRef}>
        <BlackHole lowPower={isLowPower} />
      </group>

      <SpaceEnvironment lowPower={isLowPower} />

      <Scroll html>
        <UIOverlay progress={uiProgress} onNavigate={navigate} lowPower={isLowPower} />
      </Scroll>
    </>
  );
}

export function ReliefOSScene() {
  const navigate = useNavigate();
  const { dpr, isLowPower, isPageVisible } = useScenePerformance();
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneModulesMounted, setSceneModulesMounted] = useState(false);

  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);
  const handleSceneReady = useCallback(() => {
    startTransition(() => setSceneReady(true));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootScene = () => {
      preloadLandingScene().then(() => {
        if (!cancelled) {
          startTransition(() => setSceneModulesMounted(true));
        }
      });
    };

    const warmup = () => {
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (callback: () => void) => number }).requestIdleCallback(bootScene);
      } else {
        globalThis.setTimeout(bootScene, 16);
      }
    };

    const firstPaint = window.requestAnimationFrame(() => {
      warmup();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstPaint);
    };
  }, []);

  const canvasSettings = useMemo(
    () => ({
      dpr,
      frameloop: (isPageVisible ? 'always' : 'demand') as Frameloop,
      gl: {
        antialias: !isLowPower,
        alpha: true,
        powerPreference: 'high-performance' as const,
      },
    }),
    [dpr, isLowPower, isPageVisible]
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {(!sceneReady || !sceneModulesMounted) && <SceneLoader />}

      {sceneModulesMounted ? (
        <Canvas
          dpr={canvasSettings.dpr}
          frameloop={canvasSettings.frameloop}
          gl={canvasSettings.gl}
          performance={{ min: 0.6 }}
          resize={{ debounce: { resize: 120, scroll: 120 } }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor(new THREE.Color('#000000'));
            scene.fog = new THREE.FogExp2('#020202', isLowPower ? 0.035 : 0.03);
          }}
        >
          <Suspense fallback={null}>
            <ScrollControls pages={5} damping={isLowPower ? 0.18 : 0.3} eps={0.0008}>
              <SceneContent navigate={handleNavigate} isLowPower={isLowPower} onSceneReady={handleSceneReady} />
            </ScrollControls>
          </Suspense>
        </Canvas>
      ) : null}
    </div>
  );
}
