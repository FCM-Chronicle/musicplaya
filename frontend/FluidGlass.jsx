import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import "./FluidGlass.css";

const MODEL_PATHS = {
  lens: "./assets/3d/lens.glb",
  bar: "./assets/3d/bar.glb",
  cube: "./assets/3d/cube.glb",
};

export default function FluidGlass({
  mode = "lens",
  lensProps = {},
  barProps = {},
  cubeProps = {},
  className = "",
}) {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    camera.position.set(0, 0, 4.5);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    scene.add(new THREE.HemisphereLight(0xffead5, 0x17202e, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffc48c, 3.6);
    keyLight.position.set(-2, 2, 4);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x8e9eff, 4, 8);
    rimLight.position.set(2, -1, 2);
    scene.add(rimLight);

    const group = new THREE.Group();
    scene.add(group);
    let disposed = false;
    let model = null;
    let frameId = 0;
    let lastTime = 0;

    const loader = new GLTFLoader();
    loader.load(
      MODEL_PATHS[mode] || MODEL_PATHS.lens,
      (gltf) => {
        if (disposed) return;
        model = gltf.scene;
        model.traverse((object) => {
          if (!object.isMesh) return;
          object.castShadow = false;
          object.receiveShadow = false;
          if (object.material) object.material.envMapIntensity = 1.4;
        });
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z) || 1;
        model.scale.setScalar(2.1 / maxSize);
        bounds.setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.rotation.set(0.12, 0, 0);
        group.add(model);
      },
      undefined,
      () => {
        // The toolbar keeps its CSS glass treatment until a model is supplied.
      },
    );

    const resize = () => {
      const { clientWidth, clientHeight } = canvas.parentElement || canvas;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement || canvas);
    resize();

    const animate = (time) => {
      if (disposed) return;
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const pointer = pointerRef.current;
      group.rotation.y += (pointer.x * 0.18 - group.rotation.y) * delta * 5;
      group.rotation.x += (-pointer.y * 0.1 - group.rotation.x) * delta * 5;
      if (model) model.rotation.z += delta * (mode === "bar" ? 0.12 : 0.06);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
      };
    };
    canvas.parentElement?.addEventListener("pointermove", onPointerMove);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.parentElement?.removeEventListener("pointermove", onPointerMove);
      model?.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose();
      });
      renderer.dispose();
    };
  }, [mode]);

  return <canvas ref={canvasRef} className={`fluid-glass${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}
