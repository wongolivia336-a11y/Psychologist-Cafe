"use client";

import { useEffect, useRef, useState } from "react";
import type { DishData } from "./Dish";
import type { Material, Mesh, Vector3 } from "three";

type Props = {
  dish: DishData;
  onFallback: () => void;
};

function colorFrom(value: string | undefined, fallback: string) {
  return /^#[0-9a-f]{3,8}$/i.test(value ?? "") ? value! : fallback;
}

/**
 * A deliberately small raw Three.js scene. It is kept outside R3F so the page
 * does not pay for a React renderer or a model loader before we have GLB assets.
 * The scene is also disposable: every geometry/material is released on unmount.
 */
export default function ThreeStillLife({ dish, onFallback }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    const rerenderForAppearance = () => {
      setThemeVersion((version) => version + 1);
    };
    const themeObserver = new MutationObserver(rerenderForAppearance);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-direction", "data-theme", "data-contrast"],
    });
    window.addEventListener("cafe:appearance", rerenderForAppearance);
    return () => {
      themeObserver.disconnect();
      window.removeEventListener("cafe:appearance", rerenderForAppearance);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let frame = 0;
    let cleanScene: (() => void) | undefined;
    let observer: ResizeObserver | undefined;

    const boot = async () => {
      try {
        const THREE = await import("three");
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          premultipliedAlpha: false,
          antialias: window.innerWidth > 480,
          powerPreference: "high-performance",
        });
        renderer.setClearColor(0x000000, 0);
        renderer.setClearAlpha(0);
        canvas.style.backgroundColor = "transparent";

        // Some browsers expose a WebGL context but ignore alpha compositing.
        // Do not leave a black rectangle over the light stage in that case.
        if (renderer.getContext().getContextAttributes()?.alpha === false) {
          renderer.dispose();
          if (!disposed) onFallback();
          return;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        const styles = getComputedStyle(document.documentElement);
        renderer.toneMappingExposure = Number(styles.getPropertyValue("--scene-exposure").trim()) || 1.05;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
        camera.position.set(0, 4.9, 7.7);
        camera.lookAt(0, 0.2, 0);

        const root = new THREE.Group();
        root.rotation.x = -0.1;
        scene.add(root);

        const ink = styles.getPropertyValue("--scene-shadow").trim() || "#11171a";
        const paper = styles.getPropertyValue("--scene-paper").trim() || "#d7dfdc";
        const ceramic = styles.getPropertyValue("--scene-ceramic").trim() || "#e9eeeb";
        const sceneLight = styles.getPropertyValue("--scene-light").trim() || ceramic;
        const sceneShadow = styles.getPropertyValue("--scene-shadow").trim() || ink;
        const accent = styles.getPropertyValue("--candle").trim() || "#476f87";
        const surface = styles.getPropertyValue("--moss-soft").trim() || "#9faead";
        const foodColors = (dish?.palette ?? [])
          .filter((value) => /^#[0-9a-f]{3,8}$/i.test(value))
          .slice(0, 5);
        const fallbackFood = [
          accent,
          styles.getPropertyValue("--walnut-light").trim() || "#87989c",
          styles.getPropertyValue("--moss-soft").trim() || "#a8b6ae",
          styles.getPropertyValue("--candle-light").trim() || "#607988",
          paper,
        ];

        const table = new THREE.Mesh(
          new THREE.PlaneGeometry(12, 8),
          new THREE.MeshStandardMaterial({ color: surface, roughness: 0.92, metalness: 0.02 }),
        );
        table.rotation.x = -Math.PI / 2;
        table.position.y = -0.22;
        root.add(table);

        const plate = new THREE.Group();
        const plateMaterial = new THREE.MeshPhysicalMaterial({
          color: ceramic,
          roughness: 0.3,
          metalness: 0,
          clearcoat: 0.25,
          clearcoatRoughness: 0.22,
        });
        const plateInnerMaterial = new THREE.MeshPhysicalMaterial({
          color: ink,
          roughness: 0.52,
          metalness: 0,
          clearcoat: 0.12,
        });
        const plateOuter = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.92, 0.15, 64), plateMaterial);
        const plateInner = new THREE.Mesh(new THREE.CylinderGeometry(1.43, 1.52, 0.065, 64), plateInnerMaterial);
        const plateRim = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.045, 10, 64), plateMaterial);
        plateRim.rotation.x = Math.PI / 2;
        plateInner.position.y = 0.095;
        plateRim.position.y = 0.12;
        plate.add(plateOuter, plateInner, plateRim);
        plate.position.set(-0.15, -0.1, 0.18);
        root.add(plate);

        const food = new THREE.Group();
        const positions = [
          [-0.52, 0.2, 0.05],
          [0.2, 0.22, -0.12],
          [0.62, 0.2, 0.28],
          [-0.05, 0.19, 0.54],
          [-0.55, 0.2, 0.55],
        ] as const;
        const count = dish?.items?.length ?? 0;
        positions.slice(0, Math.max(count, 1)).forEach(([x, y, z], index) => {
          const material = new THREE.MeshPhysicalMaterial({
            color: colorFrom(foodColors[index] ?? fallbackFood[index], fallbackFood[index]),
            roughness: 0.56,
            metalness: 0.02,
            clearcoat: 0.18,
          });
          const piece = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 14), material);
          piece.position.set(x, y, z);
          piece.scale.set(1.22 - index * 0.06, 0.34 + (index % 2) * 0.1, 0.72 + (index % 3) * 0.08);
          piece.rotation.y = index * 0.7;
          food.add(piece);
        });
        food.scale.setScalar(count ? 0.001 : 0);
        plate.add(food);

        const glass = new THREE.Group();
        const glassMaterial = new THREE.MeshPhysicalMaterial({
          color: accent,
          roughness: 0.08,
          transmission: 0.6,
          thickness: 0.08,
          transparent: true,
          opacity: 0.34,
          side: THREE.DoubleSide,
        });
        const glassBody = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.57, 1.45, 32, 1, true), glassMaterial);
        const glassRim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 8, 32), glassMaterial);
        const glassBase = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), glassMaterial);
        glassRim.rotation.x = Math.PI / 2;
        glassBase.rotation.x = Math.PI / 2;
        glassRim.position.y = 0.73;
        glassBase.position.y = -0.72;
        glass.add(glassBody, glassRim, glassBase);
        glass.position.set(2.25, 0.6, 0.08);
        glass.rotation.z = -0.04;
        root.add(glass);

        const paperGroup = new THREE.Group();
        const paperMaterial = new THREE.MeshStandardMaterial({ color: paper, roughness: 0.86, side: THREE.DoubleSide });
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 1.5), paperMaterial);
        sheet.rotation.x = -Math.PI / 2;
        paperGroup.add(sheet);
        const lineMaterial = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.42 });
        const linePoints: Vector3[] = [];
        for (let line = 0; line < 5; line += 1) {
          const y = 0.42 - line * 0.22;
          linePoints.push(new THREE.Vector3(-0.78, 0.025, y), new THREE.Vector3(0.75, 0.025, y));
        }
        const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePoints), lineMaterial);
        paperGroup.add(lines);
        paperGroup.position.set(-2.3, 0.02, 0.45);
        paperGroup.rotation.y = -0.12;
        root.add(paperGroup);

        const watch = new THREE.Group();
        const watchMaterial = new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.27, metalness: 0.68 });
        const watchFace = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.12, 48), watchMaterial);
        const watchRing = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 8, 48), watchMaterial);
        const handMaterial = new THREE.MeshBasicMaterial({ color: ceramic });
        const handLong = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.24), handMaterial);
        const handShort = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.16), handMaterial);
        watchRing.rotation.x = Math.PI / 2;
        handLong.position.y = 0.09;
        handLong.position.z = -0.06;
        handLong.rotation.y = 0.34;
        handShort.position.y = 0.1;
        handShort.position.z = 0.04;
        handShort.rotation.y = -0.9;
        watch.add(watchFace, watchRing, handLong, handShort);
        watch.position.set(1.62, 0.01, -1.25);
        watch.rotation.y = 0.2;
        root.add(watch);

        scene.add(new THREE.HemisphereLight(sceneLight, sceneShadow, 1.45));
        const keyLight = new THREE.DirectionalLight(sceneLight, 2.1);
        keyLight.position.set(-3, 7, 4);
        scene.add(keyLight);
        const fillLight = new THREE.PointLight(accent, 2.2, 8);
        fillLight.position.set(2.6, 2.4, 1.5);
        scene.add(fillLight);

        const pointer = { x: 0, y: 0 };
        const onPointerMove = (event: PointerEvent) => {
          const rect = canvas.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
          pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        };
        const onPointerLeave = () => { pointer.x = 0; pointer.y = 0; };
        canvas.addEventListener("pointermove", onPointerMove, { passive: true });
        canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });

        const resize = () => {
          const rect = canvas.getBoundingClientRect();
          const width = Math.max(1, rect.width);
          const height = Math.max(1, rect.height);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        observer = new ResizeObserver(resize);
        observer.observe(canvas);
        resize();

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const started = performance.now();
        const render = (time: number) => {
          if (disposed) return;
          const seconds = (time - started) / 1000;
          const reveal = dish?.items?.length ? Math.min(1, seconds / 0.85) : 0;
          const easedReveal = 1 - Math.pow(1 - reveal, 3);
          food.scale.setScalar(easedReveal);
          if (!reducedMotion) {
            root.rotation.y += (pointer.x * 0.045 - root.rotation.y) * 0.035;
            root.rotation.x += (-0.1 + pointer.y * 0.02 - root.rotation.x) * 0.035;
            watch.rotation.z = Math.sin(seconds * 0.35) * 0.015;
          }
          renderer.render(scene, camera);
          frame = requestAnimationFrame(render);
        };
        frame = requestAnimationFrame(render);

        cleanScene = () => {
          cancelAnimationFrame(frame);
          observer?.disconnect();
          canvas.removeEventListener("pointermove", onPointerMove);
          canvas.removeEventListener("pointerleave", onPointerLeave);
          scene.traverse((object) => {
            const mesh = object as Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) mesh.material.forEach((material: Material) => material.dispose());
            else if (mesh.material) mesh.material.dispose();
          });
          renderer.dispose();
        };
      } catch (error) {
        console.warn("[still-life] Three.js unavailable; using canvas fallback", error);
        if (!disposed) onFallback();
      }
    };

    void boot();
    return () => {
      disposed = true;
      observer?.disconnect();
      cleanScene?.();
    };
  }, [dish, onFallback, themeVersion]);

  return (
    <canvas
      key={themeVersion}
      ref={canvasRef}
      className="dish-canvas dish-canvas--three"
      role="img"
      aria-label={dish?.items?.length ? `桌上的 3D 静物：${dish.items.join("、")}` : "桌上还没有放下一件静物"}
    />
  );
}
