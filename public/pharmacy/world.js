import * as THREE from './vendor/three-lite.js';
import { createPharmacyArt } from './art.js';
import { PALETTE } from './geometry.js';
import { FLOOR_PLAN, NAVIGATION_PLAN, resolveLayout } from './scene-layout.js';
import { createToolMarkers } from './tool-art.js';
import { cameraFrame } from './camera-framing.js';
import { createJourney } from './journey.js';
import { createWalkingPharmacist, measureWalkingProfile } from './pharmacist.js';
import { readSceneBounds } from './spatial-audit.js';
import { validateNavigation } from './navigation.js';

export function createWorld({ container, categories, tools, onSelectCategory, onSelectTool, onJourneyState, onError }) {
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    container.append(canvas);
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.minPolarAngle = .3;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 5;
    controls.maxDistance = 80;
    controls.enablePan = false;
    cleanups.push(() => controls.dispose());
    const objects = [], rooms = new Map(), labels = [];
    container.dataset.view = 'overview';
    cleanups.push(() => { delete container.dataset.view; delete container.dataset.travel; delete container.dataset.destination; });
    let selectedCategory, selectedTool, hoveredTool, viewMode = 'overview';
    let cameraReady = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9caa9d, 1.6));
    const light = new THREE.DirectionalLight(0xfff7ee, 2.4);
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
    const links = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    links.classList.add('map-links');
    links.setAttribute('aria-hidden', 'true');
    container.append(links);
    cleanups.push(() => links.remove());
    const label = (text, position, categoryId, toolId, index) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = toolId ? 'room-label map-tool' : 'room-label zone-label';
      const caption = document.createElement('span');
      caption.textContent = text;
      if (toolId) {
        element.dataset.tool = toolId;
        const number = document.createElement('b');
        number.textContent = String(index + 1).padStart(2, '0');
        number.setAttribute('aria-hidden', 'true');
        element.append(number);
      } else element.dataset.category = categoryId;
      element.append(caption);
      element.setAttribute('aria-label', toolId ? `介紹：${text}` : `探索${text}`);
      element.setAttribute('aria-expanded', 'false');
      listen(element, 'click', () => toolId ? onSelectTool(categoryId, toolId) : onSelectCategory(categoryId));
      container.append(element);
      cleanups.push(() => element.remove());
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      links.append(line);
      element.hidden = Boolean(toolId);
      if (line) line.style.display = 'none';
      labels.push({ element, position: new THREE.Vector3(...position), categoryId, toolId, line });
    };
    box([FLOOR_PLAN.width, .35, FLOOR_PLAN.depth], [0, -.05, FLOOR_PLAN.centerZ], PALETTE.floor);
    // The physical Rx sign replaces the sixth overlay label.
    let overflowRoom;
    for (const category of categories) {
      const { position: [x, , z], color, size: [width, depth], surface = PALETTE.floor } = resolveLayout(category.id);
      if (rooms.has(category.id)) continue;
      if (resolveLayout(category.id) === resolveLayout('__overflow')) {
        if (!overflowRoom) {
          overflowRoom = box([3.8, .25, 3.6], [x, 0, z], color);
        }
        label(category.label, [x, 1.7, z - 1.3], category.id);
        console.warn('Unknown scene category; using overflow:', category.id);
        continue;
      }
      const room = box([width, .02, depth], [x, .135, z], surface, { kind: 'category', categoryId: category.id });
      rooms.set(category.id, room);
      box([Math.min(width - .5, 4.5), .02, .09], [x, .16, z + depth / 2 - .1], color);
      // Shared perimeter/dividers are composed by the art module, not five booths.
      const count = tools.filter(tool => tool.category === category.id).length;
      label(`${category.label} · ${count}`, category.id === 'internal' ? [x, .3, z + 1.5] : [x, 2.1, z - .9], category.id);
    }
    const markers = createToolMarkers(scene, resources, categories, tools);
    for (const tool of tools) {
      if (!categories.some(category => category.id === tool.category)) console.warn('Undeclared tool category:', tool.category);
      const mesh = markers.get(tool.id);
      objects.push(mesh);
      label(tool.nameZh, [mesh.position.x, mesh.position.y + .35, mesh.position.z], tool.category, tool.id, mesh.userData.index);
    }
    const art = createPharmacyArt(scene, resources, { small: small(), categories, markers, tools });
    const profile = measureWalkingProfile();
    const obstacles = readSceneBounds(scene).filter(box => box.maxY > profile.floorY + .05 && box.minY < profile.floorY + profile.height);
    const areas = Object.keys(NAVIGATION_PLAN.stops).map(id => {
      const { position: [x, , z], size } = resolveLayout(id); return { id, center: [x, z], size };
    });
    const validation = validateNavigation(NAVIGATION_PLAN, obstacles, profile, FLOOR_PLAN, areas);
    if (!validation.ok) throw new Error(`Walking layout invalid: ${validation.issues[0]}`);
    const journey = createJourney(NAVIGATION_PLAN), avatar = createWalkingPharmacist(scene, resources);
    avatar.pose(journey.snapshot());
    let intent = 'overview', lastTime = null, facing = 0;
    function journeyState() {
      return { ...journey.snapshot(), position: [avatar.root.position.x, avatar.root.position.z], categoryId: selectedCategory, toolId: selectedTool, kind: intent,
        supported: !selectedCategory || Object.hasOwn(NAVIGATION_PLAN.stops, selectedCategory),
        cameraTarget: [controls.target.x, controls.target.z], legAngle: avatar.bones.get('leg-left').rotation.x };
    }
    function emitJourney() {
      const state = journeyState();
      container.dataset.travel = state.moving ? 'moving' : state.arrived ? 'arrived' : 'idle';
      container.dataset.destination = state.destination || '';
      onJourneyState?.(state);
    }
    function poseActor(state, seconds, instant = false) {
      const desired = state.moving ? state.yaw : 0;
      const difference = Math.atan2(Math.sin(desired - facing), Math.cos(desired - facing));
      facing = instant ? desired : facing + Math.max(-seconds * 9, Math.min(seconds * 9, difference));
      avatar.pose({ ...state, yaw: facing });
    }
    const target = new THREE.Vector3();
    function framing() {
      return cameraFrame({ mode: viewMode, categoryId: selectedCategory, marker: markers.get(selectedTool)?.position, actor: avatar.root.position, aspect: camera.aspect, fov: camera.fov, small: small() });
    }
    function moveTo() {
      const { target: next, position: end } = framing();
      if (reduced.matches) { camera.position.copy(end); controls.target.copy(next); tween = null; }
      else tween = { from: camera.position.clone(), target: controls.target.clone(), end, next, start: performance.now() };
    }
    function updateToolFeedback() {
      for (const [id, mesh] of markers) {
        mesh.material.emissive.set(id === selectedTool || id === hoveredTool ? '#5b6245' : '#000000');
        mesh.scale.setScalar(id === hoveredTool ? 1.06 : 1);
      }
    }
    function highlight(categoryId, toolId) {
      viewMode = toolId ? 'tool' : categoryId ? 'category' : 'overview';
      container.dataset.view = viewMode;
      selectedCategory = categoryId;
      selectedTool = toolId;
      for (const label of labels) {
        label.element.classList.toggle('is-focused', label.toolId === toolId && Boolean(toolId));
        label.element.hidden = label.toolId ? label.categoryId !== categoryId || Boolean(toolId && label.toolId !== toolId) : Boolean(categoryId);
        if (label.element.hidden) label.line.style.display = 'none';
        label.element.setAttribute('aria-expanded', String(Boolean(label.toolId && label.toolId === toolId)));
      }
      art.selectMarker(markers.get(toolId));
      for (const [id, mesh] of rooms) mesh.material.emissive.set(id === categoryId ? '#101710' : '#000000');
      updateToolFeedback();
    }
    function arrive() {
      controls.enabled = true;
      highlight(selectedCategory, selectedTool);
      if (intent === 'hub') {
        viewMode = 'hub'; container.dataset.view = viewMode;
        for (const label of labels) { label.element.hidden = true; label.line.style.display = 'none'; }
      }
      moveTo(); emitJourney();
    }
    function begin(stop, categoryId, toolId, kind) {
      try {
        intent = kind;
        highlight(categoryId, toolId);
        if (!stop) { journey.cancel(); arrive(); return; } // generic future category
        const state = journey.request(stop, reduced.matches);
        poseActor(state, 0, reduced.matches);
        if (state.moving) {
          tween = null; controls.enabled = false; viewMode = 'travel'; container.dataset.view = viewMode;
          for (const label of labels) { label.element.hidden = Boolean(label.toolId); if (label.toolId) label.line.style.display = 'none'; }
          emitJourney();
        } else arrive();
      } catch (error) { onError(error); }
    }
    function resize() {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.fov = small() ? 43 : 34;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(devicePixelRatio, small() ? 1.5 : 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      if (cameraReady && !journey.snapshot().moving) moveTo();
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
      if (data?.kind === 'tool') {
        if (!journey.snapshot().moving && journey.snapshot().arrived && selectedCategory === data.categoryId) onSelectTool(data.categoryId, data.toolId);
        else onSelectCategory(data.categoryId);
      }
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
    listen(reduced, 'change', () => {
      const state = journey.snapshot();
      if (reduced.matches && state.moving) { poseActor(journey.request(state.destination, true), 0, true); arrive(); }
    });
    observer = new ResizeObserver(resize);
    cleanups.push(() => observer.disconnect());
    observer.observe(container);
    function placeLabels() {
      const width = container.clientWidth, height = container.clientHeight;
      const occupied = [];
      const active = [];
      for (const label of labels) {
        const { element, position, toolId, categoryId, line } = label;
        const travelling = viewMode === 'travel';
        const eligible = travelling ? !toolId : viewMode === 'hub' ? false : toolId ? categoryId === selectedCategory && (!selectedTool || toolId === selectedTool) : !selectedCategory;
        target.copy(position).project(camera);
        const finite = Number.isFinite(target.x) && Number.isFinite(target.y) && Number.isFinite(target.z);
        // Keep anchors current even while hidden, ready for a category transition.
        if (line && finite) {
          line.setAttribute('x1', (target.x + 1) * width / 2);
          line.setAttribute('y1', (1 - target.y) * height / 2);
        }
        const behind = !finite || target.z > 1 || target.z < -1;
        element.hidden = !eligible || (!travelling && behind);
        if (line) line.style.display = element.hidden || behind ? 'none' : '';
        if (element.hidden) continue;
        active.push({ label, x: finite ? (target.x + 1) * width / 2 : width / 2, y: finite ? (1 - target.y) * height / 2 : height / 2 });
      }
      // Labels stay attached to their devices, with collision-free touch targets.
      active.sort((a, b) => a.y - b.y || a.x - b.x);
      for (const { label: { element, line, categoryId }, x, y } of active) {
        const w = element.offsetWidth, h = element.offsetHeight;
        const clampX = value => Math.max(10, Math.min(width - w - 10, value));
        const clampY = value => Math.max(10, Math.min(height - h - 10, value));
        const candidates = [{ x: clampX(x - w / 2), y: clampY(y - h - (line ? 20 : 0)) }];
        for (let cy = 12; cy < height - h; cy += h + 12) {
          for (let cx = 12; cx < width - w; cx += w + 12) candidates.push({ x: cx, y: cy });
        }
        candidates.sort((a, b) => Math.hypot(a.x + w / 2 - x, a.y + h - y) - Math.hypot(b.x + w / 2 - x, b.y + h - y));
        const dock = ((small() && viewMode === 'overview') || viewMode === 'travel') && width >= 300 ? resolveLayout(categoryId).labelDock : undefined;
        const location = dock ? {
          x: dock === 'bottom' ? (width - w) / 2 : dock.startsWith('left') ? 12 : width - w - 12,
          y: dock === 'bottom' ? height - h - 8 : dock.endsWith('top') ? 8 : height * .35,
        } : candidates.find(p => occupied.every(r => p.x + w + 8 <= r.x || r.x + r.w + 8 <= p.x || p.y + h + 8 <= r.y || r.y + r.h + 8 <= p.y)) || candidates[0];
        occupied.push({ ...location, w, h });
        element.style.left = `${location.x}px`;
        element.style.top = `${location.y}px`;
        if (line) {
          line.setAttribute('x2', location.x + w / 2); line.setAttribute('y2', location.y + h / 2);
        }
      }
    }
    function render(now) {
      if (destroyed || paused) return;
      try {
        const seconds = lastTime === null ? 0 : Math.min(.25, Math.max(0, (now - lastTime) / 1000)); lastTime = now;
        const wasMoving = journey.snapshot().moving;
        const state = journey.advance(seconds);
        poseActor(state, seconds, reduced.matches);
        if (wasMoving && !state.moving) arrive();
        if (state.moving) {
          const pose = framing(), blend = 1 - Math.exp(-seconds * 6);
          camera.position.lerp(pose.position, blend); controls.target.lerp(pose.target, blend);
        } else if (tween) {
          const t = Math.min(1, (now - tween.start) / 750);
          const eased = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
          camera.position.lerpVectors(tween.from, tween.end, eased);
          controls.target.lerpVectors(tween.target, tween.next, eased);
          if (t === 1) tween = null;
        }
        controls.update();
        renderer.render(scene, camera);
        placeLabels();
        frame = requestAnimationFrame(render);
      } catch (error) { onError(error); }
    }
    resize();
    const initialFrame = framing();
    controls.target.copy(initialFrame.target);
    camera.position.copy(initialFrame.position);
    controls.update();
    cameraReady = true;
    renderer.render(scene, camera); // fail initialization before reporting ready
    frame = requestAnimationFrame(render);
    return {
      focusCategory(id) { begin(NAVIGATION_PLAN.stops[id], id, undefined, 'category'); },
      focusTool(categoryId, toolId) { begin(NAVIGATION_PLAN.stops[categoryId], categoryId, toolId, 'tool'); },
      focusHub() { begin('hub', undefined, undefined, 'hub'); },
      getJourneyState: journeyState,
      resetView() { journey.cancel(); intent = 'overview'; controls.enabled = true; highlight(); moveTo(); emitJourney(); },
      setPaused(value) {
        if (paused === value || destroyed) return;
        paused = value;
        lastTime = null;
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
