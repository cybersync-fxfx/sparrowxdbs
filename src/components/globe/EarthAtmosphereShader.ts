import * as THREE from "three";

/**
 * Custom GLSL Atmosphere Rim / Rayleigh Scattering Material
 * Creates the authentic NASA-style thin glowing blue limb around Earth.
 */
export function createAtmosphereMaterial(
  color = new THREE.Color(0x00e5ff),
  coefficient = 0.75,
  power = 3.2,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uCoefficient: { value: coefficient },
      uPower: { value: power },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uCoefficient;
      uniform float uPower;

      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        // Fresnel calculation: maximum intensity at grazing edge
        float fresnel = dot(normal, viewDir);
        float intensity = pow(1.0 - max(fresnel, 0.0), uPower) * uCoefficient;

        gl_FragColor = vec4(uColor, intensity);
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Inner Atmosphere Haze (renders on the front side just inside the limb)
 */
export function createInnerAtmosphereMaterial(
  color = new THREE.Color(0x00a8ff),
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = dot(normal, viewDir);
        float intensity = pow(1.0 - max(fresnel, 0.0), 2.5) * 0.45;
        gl_FragColor = vec4(uColor, intensity);
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
  });
}
