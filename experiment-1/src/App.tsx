import * as THREE from "three";
import vertexShader from "./shaders/vertex.glsl?raw";
import fragmentShader from "./shaders/fragment.glsl?raw";
import { onMount } from "solid-js";

function App() {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const renderer = new THREE.WebGLRenderer({ canvas });

    const pointer = new THREE.Vector2();
    window.addEventListener("mousemove", (e) => {
      pointer.x = e.clientX / window.innerWidth;
      pointer.y = 1 - e.clientY / window.innerHeight;
    });

    const camera = new THREE.OrthographicCamera(
      -1, // left
      1, // right
      1, // top
      -1, // bottom
      -1, // near,
      1 // far
    );
    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector3() },
      iMouse: { value: pointer },
    };

    const scene = new THREE.Scene();
    const plane = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      fragmentShader,
      uniforms,
    });

    scene.add(new THREE.Mesh(plane, material));

    function animate(time: number) {
      uniforms.iResolution.value.set(canvas.width, canvas.height, 1);
      uniforms.iTime.value = time * 0.001;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  });

  return (
    <div class="flex flex-col h-screen w-screen items-center justify-center p-4">
      <canvas class="h-[900px] w-[900px]" ref={canvas} />
    </div>
  );
}
export default App;
