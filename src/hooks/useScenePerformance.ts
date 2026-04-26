import { useEffect, useState } from 'react';

declare global {
  interface Navigator {
    connection?: {
      saveData?: boolean;
    };
    deviceMemory?: number;
  }
}

interface ScenePerformanceState {
  dpr: number;
  isLowPower: boolean;
  isPageVisible: boolean;
}

const getScenePerformanceState = (): ScenePerformanceState => {
  if (typeof window === 'undefined') {
    return {
      dpr: 1,
      isLowPower: false,
      isPageVisible: true,
    };
  }

  const pointerCoarse = window.matchMedia('(pointer: coarse)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smallViewport = window.innerWidth < 900;
  const saveData = navigator.connection?.saveData === true;
  const deviceMemory = navigator.deviceMemory ?? 8;
  const hardwareThreads = navigator.hardwareConcurrency ?? 8;

  const isLowPower =
    reducedMotion ||
    saveData ||
    deviceMemory <= 4 ||
    hardwareThreads <= 4 ||
    (pointerCoarse && smallViewport);

  const dprCap = isLowPower ? 1.05 : pointerCoarse ? 1.15 : 1.5;

  return {
    dpr: Math.min(window.devicePixelRatio || 1, dprCap),
    isLowPower,
    isPageVisible: document.visibilityState !== 'hidden',
  };
};

export function useScenePerformance() {
  const [state, setState] = useState<ScenePerformanceState>(getScenePerformanceState);

  useEffect(() => {
    const update = () => setState(getScenePerformanceState());

    const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarsePointerMedia = window.matchMedia('(pointer: coarse)');

    update();

    window.addEventListener('resize', update);
    document.addEventListener('visibilitychange', update);
    reducedMotionMedia.addEventListener('change', update);
    coarsePointerMedia.addEventListener('change', update);

    return () => {
      window.removeEventListener('resize', update);
      document.removeEventListener('visibilitychange', update);
      reducedMotionMedia.removeEventListener('change', update);
      coarsePointerMedia.removeEventListener('change', update);
    };
  }, []);

  return state;
}
