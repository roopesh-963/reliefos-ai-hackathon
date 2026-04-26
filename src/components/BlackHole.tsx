import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const accretionDiskShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#ff4d00') },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv - 0.5;
      float r = length(uv);
      float angle = atan(uv.y, uv.x);
      float flow1 = sin(r * 40.0 - angle - uTime * 5.0);
      float flow2 = sin(r * 80.0 + angle * 2.0 - uTime * 8.0);
      float streaks = step(0.98, random(vec2(angle * 10.0, floor(r * 20.0 - uTime * 4.0))));
      float compression = pow(1.0 - r, 3.0);
      float mask = smoothstep(0.5, 0.15, r) * smoothstep(0.1, 0.2, r);
      float detail = (flow1 * 0.4 + flow2 * 0.3 + streaks * 0.3) * compression;
      vec3 finalColor = uColor * (0.6 + 0.4 * detail);
      finalColor += uColor * (smoothstep(0.3, 0.15, r) * 0.5);
      gl_FragColor = vec4(finalColor, mask * (0.7 + 0.3 * detail));
    }
  `,
};

const gravitationalVortexShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#ff2200') },
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
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv - 0.5;
      float r = length(uv);
      float angle = atan(uv.y, uv.x);
      float spiral = sin(angle * 4.0 + r * 50.0 - uTime * 15.0);
      float fall = step(0.95, fract(r * 15.0 - uTime * 2.0));
      float mask = smoothstep(0.8, 0.1, r) * (1.0 - smoothstep(0.12, 0.15, r));
      gl_FragColor = vec4(uColor, mask * spiral * fall * 0.6);
    }
  `,
};

const energyPulseShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#00a2ff') },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 1.1, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv - 0.5;
      float r = length(uv);
      float angle = atan(uv.y, uv.x);
      float spark = step(0.92, random(vec2(angle * 5.0, floor(uTime * 15.0))));
      float rFlicker = random(vec2(uTime * 20.0, 0.0)) * 0.05;
      float mask = smoothstep(0.2, 0.15 + rFlicker, r) * (1.0 - smoothstep(0.25, 0.3 + rFlicker, r));
      float swirl = sin(angle * 8.0 + uTime * 10.0);
      vec3 color = uColor * (0.5 + 0.5 * swirl);
      gl_FragColor = vec4(color, mask * spark);
    }
  `,
};

export const BlackHole = memo(function BlackHole({ lowPower = false }: { lowPower?: boolean }) {
  const diskRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const vortexRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (diskRef.current) {
      diskRef.current.rotation.z = time * 0.4;
      (diskRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    }
    if (pulseRef.current) {
      pulseRef.current.rotation.z = -time * 2.5;
      (pulseRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    }
    if (vortexRef.current) {
      (vortexRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    }
    if (lightRef.current) {
      lightRef.current.intensity = Math.sin(time * 6.0) * 0.6 + 1.8;
    }
  });

  return (
    <group position={[0, -2, 0]}>
      <mesh frustumCulled>
        <sphereGeometry args={[1.5, lowPower ? 20 : 28, lowPower ? 20 : 28]} />
        <meshBasicMaterial color="black" />
      </mesh>

      <pointLight ref={lightRef} color="#ff4d00" distance={lowPower ? 14 : 18} intensity={1.8} />

      <mesh scale={[1.2, 1.2, 1.2]} frustumCulled>
        <sphereGeometry args={[1.5, lowPower ? 18 : 26, lowPower ? 18 : 26]} />
        <meshBasicMaterial color="#ff4d00" transparent opacity={0.18} side={THREE.BackSide} />
      </mesh>

      <mesh ref={vortexRef} rotation={[-Math.PI / 2.1, 0, 0]} frustumCulled>
        <planeGeometry args={[12, 12]} />
        <shaderMaterial
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          {...gravitationalVortexShader}
        />
      </mesh>

      <mesh ref={pulseRef} rotation={[-Math.PI / 2, 0, 0]} frustumCulled>
        <planeGeometry args={[6, 6]} />
        <shaderMaterial
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          {...energyPulseShader}
        />
      </mesh>

      <mesh ref={diskRef} rotation={[-Math.PI / 2.2, 0, 0]} frustumCulled>
        <ringGeometry args={[1.8, 6.5, lowPower ? 36 : 56]} />
        <shaderMaterial
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          {...accretionDiskShader}
        />
      </mesh>
    </group>
  );
});
