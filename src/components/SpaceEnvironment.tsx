import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';

const nebulaShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color('#4a0080') },
    uColor2: { value: new THREE.Color('#003366') },
    uOpacity: { value: 0.1 },
    uSeed: { value: 0 },
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
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uOpacity;
    uniform float uSeed;
    varying vec2 vUv;

    const mat4 bayer = mat4(
        0.0 / 16.0, 8.0 / 16.0, 2.0 / 16.0, 10.0 / 16.0,
        12.0 / 16.0, 4.0 / 16.0, 14.0 / 16.0, 6.0 / 16.0,
        3.0 / 16.0, 11.0 / 16.0, 1.0 / 16.0, 9.0 / 16.0,
        15.0 / 16.0, 7.0 / 16.0, 13.0 / 16.0, 5.0 / 16.0
    );

    float dither(vec2 pos, float brightness) {
        int x = int(mod(pos.x, 4.0));
        int y = int(mod(pos.y, 4.0));
        float threshold = bayer[x][y];
        return brightness > threshold ? 1.0 : 0.0;
    }

    float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
    vec3 mod289(vec3 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
    vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

    float noise(vec3 P){
      vec3 Pi0 = floor(P);
      vec3 Pi1 = Pi0 + vec3(1.0);
      Pi0 = mod289(Pi0);
      Pi1 = mod289(Pi1);
      vec3 Pf0 = fract(P);
      vec3 Pf1 = Pf0 - vec3(1.0);
      vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
      vec4 iy = vec4(Pi0.yy, Pi1.yy);
      vec4 iz0 = Pi0.zzzz;
      vec4 iz1 = Pi1.zzzz;
      vec4 ixy = permute(permute(ix) + iy);
      vec4 ixy0 = permute(ixy + iz0);
      vec4 ixy1 = permute(ixy + iz1);
      vec4 gx0 = ixy0 * (1.0 / 7.0);
      vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
      gx0 = fract(gx0);
      vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
      vec4 sz0 = step(gz0, vec4(0.0));
      gx0 -= sz0 * (step(0.0, gx0) - 0.5);
      gy0 -= sz0 * (step(0.0, gy0) - 0.5);
      vec4 gx1 = ixy1 * (1.0 / 7.0);
      vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
      gx1 = fract(gx1);
      vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
      vec4 sz1 = step(gz1, vec4(0.0));
      gx1 -= sz1 * (step(0.0, gx1) - 0.5);
      gy1 -= sz1 * (step(0.0, gy1) - 0.5);
      vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
      vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
      vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
      vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
      vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
      vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
      vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
      vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
      vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g100, g100), dot(g010, g010), dot(g110, g110)));
      g000 *= norm0.x;
      g100 *= norm0.y;
      g010 *= norm0.z;
      g110 *= norm0.w;
      vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g101, g101), dot(g011, g011), dot(g111, g111)));
      g001 *= norm1.x;
      g101 *= norm1.y;
      g011 *= norm1.z;
      g111 *= norm1.w;
      float n000 = dot(g000, Pf0);
      float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
      float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
      float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
      float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
      float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
      float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
      float n111 = dot(g111, Pf1);
      vec3 fade_xyz = fade(Pf0);
      vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
      vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
      float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
      return 2.2 * n_xyz;
    }

    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.5;
      vec3 shift = vec3(100.0);
      for (int i = 0; i < 5; ++i) {
        v += a * noise(p);
        p = p * 2.0 + shift;
        a *= 0.5;
      }
      return v;
    }

    float worley(vec3 p) {
        vec3 n = floor(p);
        vec3 f = fract(p);
        float dis = 1.0;
        for(int x = -1; x <= 1; x++){
            for(int y = -1; y <= 1; y++){
                for(int z = -1; z <= 1; z++){
                    vec3 p_node = vec3(x, y, z);
                    vec3 p_rand = fract(sin(vec3(dot(n + p_node, vec3(127.1, 311.7, 74.7)),
                                                dot(n + p_node, vec3(269.5, 183.3, 246.1)),
                                                dot(n + p_node, vec3(113.5, 271.9, 124.6)))) * 43758.5453);
                    vec3 p_res = p_node + p_rand - f;
                    dis = min(dis, dot(p_res, p_res));
                }
            }
        }
        return sqrt(dis);
    }

    float pattern(vec3 p, out vec3 q, out vec3 r) {
      q.x = fbm(p + vec3(0.0, 0.0, 0.0));
      q.y = fbm(p + vec3(5.2, 1.3, 2.7));
      q.z = fbm(p + vec3(2.1, 4.4, 0.5));
      r.x = fbm(p + 4.0 * q + vec3(1.7, 9.2, 3.3));
      r.y = fbm(p + 4.0 * q + vec3(8.3, 2.8, 1.5));
      r.z = fbm(p + 4.0 * q + vec3(0.5, 3.1, 8.8));
      float w = worley(p * 1.5 + uTime * 0.1);
      return fbm(p + 4.0 * r) * (1.0 - w * 0.4);
    }

    void main() {
      vec2 uv = vUv - 0.5;
      float d = length(uv);
      float mask = smoothstep(0.5, 0.1, d);
      float chromShift = d * 0.05;
      vec3 p = vec3(vUv * 2.5, uTime * 0.04 + uSeed);
      vec3 q, r;
      float fR = pattern(p + vec3(chromShift, 0.0, 0.0), q, r);
      float fG = pattern(p, q, r);
      float fB = pattern(p - vec3(chromShift, 0.0, 0.0), q, r);
      vec3 colorR = mix(uColor1, uColor2, clamp(fR * fR * 4.0, 0.0, 1.0));
      vec3 colorG = mix(uColor1, uColor2, clamp(fG * fG * 4.0, 0.0, 1.0));
      vec3 colorB = mix(uColor1, uColor2, clamp(fB * fB * 4.0, 0.0, 1.0));
      vec3 finalColor = vec3(colorR.r, colorG.g, colorB.b);
      finalColor = mix(finalColor, vec3(0.8, 0.9, 1.0), clamp(length(q), 0.0, 1.0) * 0.2);
      finalColor = mix(finalColor, vec3(1.0, 0.6, 0.2), clamp(length(r.x), 0.0, 1.0) * 0.15);
      float density = smoothstep(-0.1, 0.55, (fR + fG + fB) / 3.0);
      float alpha = density * mask * uOpacity;
      float brightness = (finalColor.r + finalColor.g + finalColor.b) / 3.0;
      alpha *= 0.8 + 0.2 * dither(gl_FragCoord.xy, brightness);
      float glow = exp(-d * 10.0) * 0.3;
      finalColor += glow * uColor2;
      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
};

const NebulaCloud = memo(function NebulaCloud({
  position,
  color1,
  color2,
  seed,
}: {
  position: [number, number, number];
  color1: string;
  color2: string;
  seed: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(color1) },
      uColor2: { value: new THREE.Color(color2) },
      uOpacity: { value: 0.16 },
      uSeed: { value: seed },
    }),
    [color1, color2, seed]
  );

  return (
    <mesh position={position} frustumCulled>
      <planeGeometry args={[30, 30]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={nebulaShader.vertexShader}
        fragmentShader={nebulaShader.fragmentShader}
      />
    </mesh>
  );
});

export const SpaceEnvironment = memo(function SpaceEnvironment({ lowPower = false }: { lowPower?: boolean }) {
  const nebulaRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (nebulaRef.current) {
      nebulaRef.current.rotation.y = state.clock.elapsedTime * 0.008;
    }
  });

  const clouds = useMemo(() => {
    const cloudCount = lowPower ? 4 : 8;
    return [...Array(cloudCount)].map((_, index) => ({
      position: [
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50,
        -18 - Math.random() * 12,
      ] as [number, number, number],
      color1: index % 2 === 0 ? '#4a0080' : '#001a4d',
      color2: index % 2 === 0 ? '#800080' : '#0055ff',
      seed: Math.random() * 500,
    }));
  }, [lowPower]);

  return (
    <group>
      <Stars
        radius={100}
        depth={50}
        count={lowPower ? 1800 : 3600}
        factor={lowPower ? 3 : 4}
        saturation={0}
        fade
        speed={lowPower ? 0.5 : 0.8}
      />

      <Sparkles
        count={lowPower ? 160 : 280}
        size={lowPower ? 1.6 : 2}
        scale={20}
        color="#ff4d00"
        speed={0.35}
      />

      <Sparkles
        count={lowPower ? 90 : 150}
        size={lowPower ? 2.2 : 3}
        scale={15}
        color="#00a2ff"
        speed={0.6}
      />

      <group ref={nebulaRef}>
        {clouds.map((cloud, index) => (
          <Float key={`cloud-${index}`} speed={0.35} rotationIntensity={0.28} floatIntensity={0.7}>
            <NebulaCloud {...cloud} />
          </Float>
        ))}
      </group>

      <ambientLight intensity={0.16} />
      <pointLight position={[0, 0, 0]} intensity={lowPower ? 1.2 : 1.6} color="#ff4d00" distance={18} />
      {!lowPower && <pointLight position={[0, 10, 0]} intensity={0.8} color="#00a2ff" distance={26} />}
    </group>
  );
});
