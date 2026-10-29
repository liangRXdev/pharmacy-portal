import * as THREE from './vendor/three-lite.js';
import { createPharmacyArt } from './art.js';
import { PALETTE } from './geometry.js';
import { resolveLayout, resolveToolPosition } from './scene-layout.js';

export function createWorld({ container, categories, tools, onSelectCategory, onSelectTool, onError }) {
  const resources = [], cleanups = [];
  let renderer, canvas, controls, observer;
  let frame = 0, paused = false, destroyed = false, tween = null;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(frame);
    for (const cleanup of cleanups.reverse()) cleanup();
    resources.forEach(resource => resource.dispose());
    renderer?.dispose();
    renderer?.forceContextLoss();
    canvas?.remove();
  }
  function listen(target, type, handler) {
    target.addEventListener(type, handler);
    cleanups.push(() => target.removeEventListener(type, handler));
  }
  try {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e9e7dc');
    const small = () => container.clientWidth < 768;
    const camera = new THREE.PerspectiveCamera(small() ? 43 : 34, 1, .1, 150);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    container.append(canvas);
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.minPolarAngle = .3;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 5;
    controls.maxDistance = 46;
    controls.enablePan = false;
    cleanups.push(() => controls.dispose());
    const objects = [], rooms = new Map(), markers = new Map(), labels = [];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9caa9d, 2.0));
    const light = new THREE.DirectionalLight(0xfff7ee, 2.0);
    light.position.set(-5, 15, 8);
    scene.add(light);
    const box = (size, position, color, metadata) => {
      const geometry = new THREE.BoxGeometry(...size);
      const material = new THREE.MeshStandardMaterial({ color, roughness: .9 });
      resources.push(geometry, material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      if (metadata) { mesh.userData = metadata; objects.push(mesh); }
      scene.add(mesh);
      return mesh;
    };
    const label = (text, position) => {
      const element = document.createElement('span');
      element.className = 'room-label zone-label';
      element.textContent = text;
      container.append(element);
      cleanups.push(() => element.remove());
      labels.push({ element, position: new THREE.Vector3(...position) });
    };
    box([17, .35, 17], [0, -.05, 2], PALETTE.floor);
    // The physical Rx sign replaces the sixth overlay label.
    let overflowRoom;
    for (const category of categories) {
      const { position: [x, , z], color } = resolveLayout(category.id);
      if (rooms.has(category.id)) continue;
      if (resolveLayout(category.id) === resolveLayout('__overflow')) {
        if (!overflowRoom) {
          overflowRoom = box([3.8, .25, 3.6], [x, 0, z], color);
          label('其他工作區', [x, 1.7, z - 1.3]);
        }
        console.warn('Unknown scene category; using overflow:', category.id);
        continue;
      }
      const room = box([3.8, .02, 3.6], [x, .135, z], PALETTE.floor, { kind: 'category', categoryId: category.id });
      rooms.set(category.id, room);
      box([2.8, .02, .09], [x, .16, z + 1.7], color);
      // Shared perimeter/dividers are composed by the art module, not five booths.
      label(category.label, [x, .28, z + 1.75]);
      labels.at(-1).categoryId = category.id;
    }
    // Unknown categories and undeclared tools share deterministic nonoverlapping slots.
    let overflowIndex = 0;
    const indices = new Map();
    for (const tool of tools) {
      const known = rooms.has(tool.category) && resolveLayout(tool.category) !== resolveLayout('__overflow');
      if (!categories.some(category => category.id === tool.category)) console.warn('Undeclared tool category:', tool.category);
      const index = known ? (indices.get(tool.category) || 0) : overflowIndex++;
      indices.set(tool.category, index + 1);
      const position = resolveToolPosition(known ? tool.category : '__overflow', index);
      const mesh = box([.52, .4, .12], position, '#365c64', { kind: 'tool', categoryId: tool.category, toolId: tool.id });
      markers.set(tool.id, mesh);
    }
    const art = createPharmacyArt(scene, resources, { small: small(), categories, markers });
    const target = new THREE.Vector3();
    function moveTo(center, overview = false) {
      const next = new THREE.Vector3(...center);
      const offset = overview ? (small() ? new THREE.Vector3(17, 21.4, 25) : new THREE.Vector3(15, 20, 24)) : new THREE.Vector3(7, 9, 11);
      const end = next.clone().add(offset);
      if (reduced.matches) { camera.position.copy(end); controls.target.copy(next); tween = null; }
      else tween = { from: camera.position.clone(), target: controls.target.clone(), end, next, start: performance.now() };
    }
    let selectedTool, hoveredTool;
    const toolLabel = document.createElement('span');
    toolLabel.className = 'room-label';
    toolLabel.hidden = true;
    container.append(toolLabel);
    cleanups.push(() => toolLabel.remove());
    const toolNames = new Map(tools.map(tool => [tool.id, tool.nameZh]));
    function updateToolFeedback() {
      for (const [id, mesh] of markers) {
        mesh.material.emissive.set(id === selectedTool || id === hoveredTool ? '#5b6245' : '#000000');
        mesh.scale.setScalar(id === hoveredTool ? 1.06 : 1);
      }
    }
    function highlight(categoryId, toolId) {
      selectedTool = toolId;
      for (const label of labels) label.element.classList.toggle('is-focused', label.categoryId === categoryId);
      art.selectMarker(markers.get(toolId));
      for (const [id, mesh] of rooms) mesh.material.emissive.set(id === categoryId ? '#273d2f' : '#000000');
      updateToolFeedback();
    }
    function resize() {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.fov = small() ? 43 : 34;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(devicePixelRatio, small() ? 1.5 : 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const hit = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(objects)[0]?.object;
    };
    let down;
    const pointers = new Set();
    function pointerDown(event) {
      pointers.add(event.pointerId);
      down = pointers.size === 1 && event.isPrimary && event.button === 0
        ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    }
    function pointerUp(event) {
      const tap = down;
      down = null;
      pointers.delete(event.pointerId);
      if (!tap || tap.id !== event.pointerId || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 6) return;
      const data = hit(event)?.userData;
      if (data?.kind === 'tool') onSelectTool(data.categoryId, data.toolId);
      else if (data?.kind === 'category') onSelectCategory(data.categoryId);
    }
    function pointerMove(event) {
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down = null;
      const mesh = hit(event);
      canvas.style.cursor = mesh ? 'pointer' : 'grab';
      hoveredTool = mesh?.userData.toolId;
      updateToolFeedback();
    }
    function pointerCancel(event) { pointers.delete(event.pointerId); down = null; }
    function pointerLeave() { hoveredTool = undefined; updateToolFeedback(); }
    function cancelTween() { tween = null; }
    function contextLost(event) { event.preventDefault(); onError(new Error('WebGL context lost')); }
    listen(canvas, 'pointerdown', pointerDown);
    listen(canvas, 'pointerup', pointerUp);
    listen(canvas, 'pointermove', pointerMove);
    listen(canvas, 'webglcontextlost', contextLost);
    listen(canvas, 'pointercancel', pointerCancel);
    listen(canvas, 'pointerleave', pointerLeave);
    listen(controls, 'start', cancelTween);
    observer = new ResizeObserver(resize);
    cleanups.push(() => observer.disconnect());
    observer.observe(container);
    function render(now) {
      if (destroyed || paused) return;
      try {
        if (tween) {
          const t = Math.min(1, (now - tween.start) / 750);
          const eased = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
          camera.position.lerpVectors(tween.from, tween.end, eased);
          controls.target.lerpVectors(tween.target, tween.next, eased);
          if (t === 1) tween = null;
        }
        controls.update();
        renderer.render(scene, camera);
        for (const { element, position } of labels) {
          target.copy(position).project(camera);
          element.style.left = `${(target.x + 1) * container.clientWidth / 2}px`;
          element.style.top = `${(1 - target.y) * container.clientHeight / 2}px`;
          element.hidden = target.z > 1 || target.z < -1;
        }
        const toolId = hoveredTool || selectedTool;
        const marker = markers.get(toolId);
        toolLabel.hidden = !marker;
        if (marker) {
          target.copy(marker.position);
          target.y += .7;
          target.project(camera);
          toolLabel.textContent = toolNames.get(toolId);
          toolLabel.style.left = `${(target.x + 1) * container.clientWidth / 2}px`;
          toolLabel.style.top = `${(1 - target.y) * container.clientHeight / 2}px`;
          toolLabel.hidden = target.z > 1 || target.z < -1;
        }
        frame = requestAnimationFrame(render);
      } catch (error) { onError(error); }
    }
    resize();
    controls.target.set(0, 0, 2);
    camera.position.set(...(small() ? [17, 21.4, 27] : [15, 20, 26]));
    controls.update();
    renderer.render(scene, camera); // fail initialization before reporting ready
    frame = requestAnimationFrame(render);
    return {
      focusCategory(id) { highlight(id); moveTo(resolveLayout(id).position); },
      focusTool(categoryId, toolId) { highlight(categoryId, toolId); moveTo(markers.get(toolId)?.position.toArray() || resolveLayout(categoryId).position); },
      resetView() { highlight(); moveTo([0, 0, 2], true); },
      setPaused(value) {
        if (paused === value || destroyed) return;
        paused = value;
        cancelAnimationFrame(frame);
        if (!paused) frame = requestAnimationFrame(render);
      },
      destroy,
    };
  } catch (error) {
    destroy();
    throw error;
  }
}
