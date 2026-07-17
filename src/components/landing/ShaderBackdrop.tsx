"use client";

import { useEffect, useRef } from 'react';
import { useTheme } from '@/components/ThemeProvider';

/**
 * Full-viewport WebGL2 aurora backdrop for the landing page.
 *
 * - No dependencies: a single fragment shader (fbm value-noise aurora)
 *   tinted with the brand palette per theme.
 * - Pointer-reactive: the field drifts gently toward the cursor.
 * - Respects prefers-reduced-motion (renders one static frame).
 * - Pauses when the tab is hidden; caps DPR at 1.5 for cheap fill-rate.
 * - Falls back to nothing when WebGL2 is unavailable — the page's static
 *   CSS gradient glow underneath remains.
 */

const VERT = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
void main() { gl_Position = vec4(P[gl_VertexID], 0., 1.); }
`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_pointer;   // -0.5..0.5
uniform vec3 u_colA;      // primary aurora tint
uniform vec3 u_colB;      // secondary tint
uniform vec3 u_colC;      // tertiary tint
uniform float u_alpha;    // overall strength

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1., 0.)), u.x),
    mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;

  float t = u_time * 0.05;
  vec2 drift = u_pointer * 0.25;

  // Two warped fbm layers create the aurora ribbons
  vec2 q = vec2(
    fbm(p * 1.6 + drift + vec2(t, -t * 0.7)),
    fbm(p * 1.6 - drift + vec2(-t * 0.8, t * 0.6))
  );
  float f = fbm(p * 2.2 + q * 1.4 + vec2(t * 0.5, -t * 0.3));

  // Ribbon bands biased to the top of the viewport
  float band = smoothstep(0.35, 0.85, f) * smoothstep(1.05, 0.15, uv.y);

  vec3 col = mix(u_colA, u_colB, clamp(q.x * 1.6, 0.0, 1.0));
  col = mix(col, u_colC, clamp(q.y * 1.2, 0.0, 1.0) * 0.6);

  // Soft grain to avoid banding
  float grain = (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * 0.03;

  float a = band * u_alpha;
  outColor = vec4(col * a + grain * a, a);
}
`;

const PALETTES = {
  dark: {
    colA: [0.83, 0.71, 0.35], // warm gold
    colB: [0.48, 0.61, 0.31], // olive green
    colC: [0.25, 0.36, 0.22], // deep moss
    alpha: 0.5,
  },
  light: {
    colA: [0.79, 0.71, 0.35], // soft gold
    colB: [0.54, 0.66, 0.42], // sage
    colC: [0.91, 0.87, 0.72], // cream
    alpha: 0.3,
  },
} as const;

export default function ShaderBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const paletteRef = useRef(PALETTES[theme === 'dark' ? 'dark' : 'light']);
  paletteRef.current = PALETTES[theme === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[ShaderBackdrop]', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uPointer = gl.getUniformLocation(prog, 'u_pointer');
    const uColA = gl.getUniformLocation(prog, 'u_colA');
    const uColB = gl.getUniformLocation(prog, 'u_colB');
    const uColC = gl.getUniformLocation(prog, 'u_colC');
    const uAlpha = gl.getUniformLocation(prog, 'u_alpha');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.tx = e.clientX / window.innerWidth - 0.5;
      pointer.ty = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      // Render at 60% internal resolution — the field is soft, so this is invisible
      const scale = 0.6 * dpr;
      canvas.width = Math.max(1, Math.floor(window.innerWidth * scale));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let running = true;
    const start = performance.now();

    const draw = (now: number) => {
      const pal = paletteRef.current;
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uPointer, pointer.x, -pointer.y);
      gl.uniform3fv(uColA, pal.colA as unknown as Float32Array | number[]);
      gl.uniform3fv(uColB, pal.colB as unknown as Float32Array | number[]);
      gl.uniform3fv(uColC, pal.colC as unknown as Float32Array | number[]);
      gl.uniform1f(uAlpha, pal.alpha);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!reducedMotion && running) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running && !reducedMotion) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
