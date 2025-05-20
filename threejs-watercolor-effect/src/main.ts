import * as THREE from "three";

// @ts-ignore
import { OrbitControls } from "three/addons/controls/OrbitControls";
// @ts-ignore
import Stats from "three/examples/jsm/libs/stats.module";

import fragment from "./shaders/fragment.glsl";
import FBOfragment from "./shaders/fbo.glsl";
import NEWfragment from "./shaders/new.glsl";
import vertex from "./shaders/vertex.glsl";

const width = window.innerWidth;
const height = window.innerHeight;

export class Sketch {
  bgColor = 0x000000;
  width = window.innerWidth;
  height = window.innerHeight;

  controls: OrbitControls;
  stats = Stats();

  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({
    alpha: false,
    antialias: true,
  });
  // TODO: naming
  // A render target is a buffer where the video card
  // draws pixels for a scene that is being rendered
  // in the background. It is used in different effects,
  // such as applying postprocessing to a rendered image
  // before displaying it on the screen.
  sourceTarget = new THREE.WebGLRenderTarget(width, height);
  targetA = new THREE.WebGLRenderTarget(width, height);
  targetB = new THREE.WebGLRenderTarget(width, height);
  targetFinal = new THREE.WebGLRenderTarget(width, height);

  camera = new THREE.PerspectiveCamera(
    /* The first attribute is the field of view.
       FOV is the extent of the scene that is seen on the display at any given moment.
       The value is in degrees.
    */
    75,
    /* The second one is the aspect ratio. You almost always want to use
       the width of the element divided by the height
    */
    width / height,
    /* The next two attributes are the near and far clipping plane.
       What that means, is that objects further away from the camera
       than the value of far or closer than near won't be rendered
    */
    0.1,
    1000
  );

  // plane: THREE.Mesh;
  // PlaneGeometry(width : Float, height : Float, widthSegments : Integer, heightSegments : Integer)
  geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector4(this.width, this.height, 1, 1),
      },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
  });

  // TODO: use existing scenes and targets
  bgTarget = new THREE.WebGLRenderTarget(width, height);
  bgScene = new THREE.Scene();
  bgSceneBg = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  box = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );

  fboScene = new THREE.Scene();
  fboCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  fboMaterial: THREE.ShaderMaterial;
  fboQuad: THREE.Mesh;

  anotherScene = new THREE.Scene();
  anotherCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  another: THREE.ShaderMaterial;
  anotherQuad: THREE.Mesh;

  finalScene = new THREE.Scene();
  finalQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: null })
  );

  // Raycaster
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  raycasterPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshBasicMaterial({
      color: 0xff0000,
      side: THREE.DoubleSide,
    })
  );

  pointerSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 20, 20),
    new THREE.MeshBasicMaterial({
      color: 0xff8800,
    })
  );

  constructor() {
    // this.renderer.clear();
    this.renderer.setClearColor(this.bgColor, 1);
    this.renderer.setPixelRatio(Math.max(window.devicePixelRatio, 1));

    this.camera.position.set(0, 0, 1);
    this.fboCamera.position.set(0, 0, 1);
    this.anotherCamera.position.set(0, 0, 1);

    // Creats and render background
    // TODO: possibly remove and use existing scenes and render targets
    this.bgSceneBg.position.z = -1;
    this.box.position.z = -0.5;
    this.bgScene.add(this.bgSceneBg);
    // this.bgScene.add(this.box);
    this.renderer.setRenderTarget(this.bgTarget);
    this.renderer.render(this.bgScene, this.camera);

    this.fboMaterial = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        tDiffuse: { value: null },
        tPrev: { value: this.bgTarget.texture },
        uTime: { value: 0 },
        uResolution: {
          value: new THREE.Vector4(this.width, this.height, 1, 1),
        },
      },
      vertexShader: vertex,
      fragmentShader: FBOfragment,
      transparent: true,
    });

    this.fboQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.fboMaterial
    );

    this.fboScene.add(this.fboQuad);

    this.another = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        tSource: { value: this.targetA.texture },
        uResolution: {
          value: new THREE.Vector4(this.width, this.height, 1, 1),
        },
      },
      vertexShader: vertex,
      fragmentShader: NEWfragment,
      transparent: true,
    });

    this.anotherQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.another
    );

    this.anotherScene.add(this.anotherQuad);

    // this.plane = new THREE.Mesh(this.geometry, this.material);
    // this.scene.add(this.plane);

    this.finalScene.add(this.finalQuad);

    document.body.append(this.renderer.domElement);
    document.body.append(this.stats.domElement);

    this.resize();
    this.setupResize();
    this.setupPipeline();
    this.addObjects();
    this.renderer.setAnimationLoop(this.render);
    this.mouseEvents();
  }

  render = () => {
    this.stats.update();
    // 1. Render source scene
    this.renderer.setRenderTarget(this.sourceTarget);
    this.renderer.render(this.scene, this.camera);

    this.renderer.setRenderTarget(this.targetA);
    this.renderer.render(this.fboScene, this.fboCamera);
    this.fboMaterial.uniforms.uTime.value += 0.05;
    this.fboMaterial.uniforms.tDiffuse.value = this.sourceTarget.texture;
    // 2. Save the rendered texture for use in the next step after swap
    //   2.1 In next render renderTarget will be this.targetB (after swap)
    //       tDiffues will be texture from source
    //       tPrev will be saved previous texture
    this.fboMaterial.uniforms.tPrev.value = this.targetA.texture; // get the previous texture

    // remove white / transform to alpha
    this.another.uniforms.tSource.value = this.targetA.texture;
    this.renderer.setRenderTarget(this.targetFinal);
    this.renderer.render(this.anotherScene, this.anotherCamera);

    // final output
    this.finalQuad.material.map = this.targetFinal.texture;
    this.renderer.setRenderTarget(null);

    // Plane with shader material which uses previous scene as a texture
    this.renderer.render(this.finalScene, this.fboCamera);

    // swap
    [this.targetA, this.targetB] = [this.targetB, this.targetA];
  };

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.material.uniforms.uResolution.value.set(width, height, 1, 1);

    this.sourceTarget.width = this.width;
    this.sourceTarget.height = this.height;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
  }

  setupResize() {
    window.addEventListener("resize", () => this.resize());
  }

  setupPipeline() {}

  addObjects() {
    // this.scene.add(this.raycasterPlane);
    this.scene.add(this.pointerSphere);
  }

  mouseEvents() {
    window.addEventListener("pointermove", (evt) => {
      // calculate pointer position in normalized device coordinates
      // (-1 to +1) for both components
      this.pointer.x = (evt.clientX / this.width) * 2 - 1;
      this.pointer.y = -(evt.clientY / this.height) * 2 + 1;

      // update the picking ray with the camera and pointer position
      this.raycaster.setFromCamera(this.pointer, this.camera);

      const intersects = this.raycaster.intersectObjects([this.raycasterPlane]);
      if (intersects.length > 0) {
        this.pointerSphere.position.copy(intersects[0].point);
        if (evt.shiftKey) {
          this.pointerSphere.material.color.set(0xff8800);
        } else {
          this.pointerSphere.material.color.set(0xffff00);
        }
      }
    });
  }
}

const sketch = new Sketch();
