import { AUTHOR } from './identity.js';

const $ = id => document.getElementById(id);
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
let data, world, selectedCategory, selectedTool, lastTrigger, focusOnArrival = false;
function navigate(category, tool, view = 'map') {
  const entering = category && !tool && category !== selectedCategory;
  if (entering) focusOnArrival = true;
  else if (!tool) focusOnArrival = false;
  if (tool) lastTrigger = [...document.querySelectorAll(`[data-tool="${CSS.escape(tool)}"]`)]
    .find(node => node.getClientRects().length) || document.activeElement;
  else if (!selectedTool) lastTrigger = document.activeElement;
  const hash = category ? `#/${encodeURIComponent(category)}${tool ? '/' + encodeURIComponent(tool) : ''}` : '';
  const pharmacyPoint = category && category === selectedCategory ? history.state?.pharmacyPoint : undefined;
  history.pushState({ pharmacyView: view, pharmacyPoint }, '', location.pathname + location.search + hash);
  route();
}
function journeyChanged(state) {
  if (state.kind === 'free') {
    selectedCategory = state.categoryId; selectedTool = undefined; focusOnArrival = false;
    const hash = selectedCategory ? `#/${encodeURIComponent(selectedCategory)}` : '';
    history.replaceState({ pharmacyPoint: state.target }, '', location.pathname + location.search + hash);
  }
  if (state.categoryId !== selectedCategory || state.toolId !== selectedTool) return;
  const category = data.categories.find(item => item.id === selectedCategory);
  const label = category?.label || (state.kind === 'free' ? '選定位置' : 'Rx Hub');
  $('scene-secondary').hidden = true;
  if (state.moving) {
    $('scene-title').textContent = `前往${label}…`;
    $('scene-help').textContent = state.kind === 'hub' ? '抵達後即可認識作者與 GitHub 專案。'
      : state.kind === 'free' ? '探索中；在工作區附近停下後即可查看工具。'
      : '抵達後即可查看工具；選擇另一工作區可改道。';
    $('status').textContent = `藥師正前往${label} · 可隨時改目的地。`;
    renderDetail(null);
  } else if (state.arrived || !state.supported) {
    const count = data.tools.filter(tool => tool.category === selectedCategory).length;
    $('scene-title').textContent = category ? `${label} · ${count} 個工具` : state.kind === 'free' ? '已到達選定位置' : 'Rx Hub · 關於作者';
    $('scene-help').textContent = category ? '選擇工具查看介紹。' : state.kind === 'free' ? '在工作區附近停下後，即可查看工具。' : '認識工具背後的作者，再探索五個工作領域。';
    $('status').textContent = state.supported ? `已抵達${label} · ${category ? '點選設備名稱查看工具。' : '可返回全景選擇工作區。'}` : `${label} · 點選設備名稱查看工具。`;
    if (state.kind === 'hub') renderAuthor();
    else renderDetail(selectedTool ? data.tools.find(tool => tool.id === selectedTool) : null);
    if (focusOnArrival && category && !selectedTool) {
      document.querySelector('#world .map-tool:not([hidden])')?.focus({ preventScroll: true }); focusOnArrival = false;
    }
  } else {
    $('scene-secondary').hidden = false;
    $('status').textContent = `${data.categories.length} 個工作區 · ${data.tools.length} 項工具 · 選擇工作區，藥師會帶你前往。`;
  }
}
function safeLink(value, label) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const link = el('a', label, 'tool-link');
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  } catch { return null; }
}
function renderDetail(tool) {
  $('explore').setAttribute('aria-expanded', 'false');
  $('detail').dataset.content = 'tool';
  const content = $('detail-content');
  content.replaceChildren();
  if (!tool) {
    const wasOpen = !$('detail').hidden;
    $('detail').hidden = true;
    if (wasOpen) {
      const equivalent = lastTrigger?.dataset.tool && [...document.querySelectorAll(`[data-tool="${CSS.escape(lastTrigger.dataset.tool)}"]`)]
        .find(node => node.getClientRects().length);
      (lastTrigger?.isConnected && lastTrigger.getClientRects().length ? lastTrigger : equivalent || $('overview')).focus({ preventScroll: true });
    }
    return;
  }
  const heading = el('h2', tool.nameZh);
  heading.id = 'detail-title';
  heading.tabIndex = -1;
  content.append(heading, el('p', tool.name, 'english'), el('p', tool.description));
  const tags = el('div', null, 'tags');
  for (const tag of (tool.tags || []).slice(0, 3)) tags.append(el('span', tag, 'tag'));
  content.append(tags, el('p', `${tool.platform} · ${tool.status}`));
  const links = el('div', null, 'detail-links');
  const open = safeLink(tool.url, '開啟工具 ↗');
  links.append(open || el('p', '院內系統 / Restricted'));
  const repo = safeLink(tool.repo, 'GitHub ↗');
  if (repo) links.append(repo);
  content.append(links);
  $('detail').hidden = false;
  heading.focus({ preventScroll: true });
}
function renderAuthor() {
  const content = $('detail-content');
  const heading = el('h2', AUTHOR.name);
  heading.id = 'detail-title'; heading.tabIndex = -1;
  const article = el('article', null, 'author-card');
  article.append(el('p', 'RX HUB · HOME', 'eyebrow'), heading, el('p', AUTHOR.role, 'author-role'),
    el('p', AUTHOR.introduction), el('p', AUTHOR.description));
  article.append(el('p', `${data.categories.length} 個工作領域 · ${data.tools.length} 項工具`, 'author-summary'));
  const link = safeLink(AUTHOR.github, '查看 GitHub 專案 ↗');
  if (link) { link.classList.add('author-link'); article.append(link); }
  content.replaceChildren(article);
  $('detail').dataset.content = 'author'; $('detail').hidden = false;
  $('explore').setAttribute('aria-expanded', 'true');
  heading.focus({ preventScroll: true });
}
function route() {
  if (!data) return;
  let parts;
  try { parts = location.hash ? location.hash.slice(1).split('/').slice(1).map(decodeURIComponent) : []; }
  catch { parts = ['invalid']; }
  let [categoryId, toolId] = parts;
  let category = data.categories.find(item => item.id === categoryId);
  const tool = data.tools.find(item => item.id === toolId);
  if ((categoryId && !category) || (toolId && !tool) || parts.length > 2 || (location.hash && !location.hash.startsWith('#/'))) {
    console.warn('Unknown pharmacy route; returning to overview');
    history.replaceState(null, '', location.pathname + location.search);
    categoryId = toolId = category = undefined;
  } else if (tool && tool.category !== categoryId) {
    categoryId = tool.category;
    category = data.categories.find(item => item.id === categoryId);
    history.replaceState(null, '', `${location.pathname}${location.search}#/${encodeURIComponent(categoryId)}/${encodeURIComponent(toolId)}`);
  }
  selectedCategory = categoryId;
  selectedTool = toolId;
  const hubView = !categoryId && !toolId && history.state?.pharmacyView === 'hub' && Boolean(world);
  for (const button of $('categories').children) button.setAttribute('aria-pressed', String(button.dataset.category === (categoryId || '')));
  $('list-title').textContent = category?.label || '全部工具';
  const tools = categoryId ? data.tools.filter(item => item.category === categoryId) : data.tools;
  $('count').textContent = `${tools.length} 個工具`;
  $('scene-title').textContent = hubView ? 'Rx Hub · 關於作者' : category ? `${category.label} · ${tools.length} 個工具` : '選擇工作區開始探索';
  $('scene-help').textContent = document.documentElement.dataset.world === 'fallback'
    ? '3D 目前無法使用，請使用下方備援分類與工具清單。'
    : hubView ? '認識工具背後的作者，再探索五個工作領域。'
    : category ? '選擇工具查看介紹。'
    : '藥師會帶你前往，抵達後即可查看工具。';
  $('scene-secondary').hidden = Boolean(category || hubView || document.documentElement.dataset.world === 'fallback');
  $('tools').replaceChildren(...tools.map(item => {
    const button = el('button', null, 'tool-button');
    button.type = 'button';
    button.dataset.tool = item.id;
    button.append(el('strong', item.nameZh), el('small', item.name));
    button.onclick = () => navigate(item.category, item.id);
    return button;
  }));
  if (history.state?.pharmacyPoint && !toolId && world) world.focusPoint(history.state.pharmacyPoint);
  else if (toolId) world?.focusTool(categoryId, toolId);
  else if (categoryId) world?.focusCategory(categoryId);
  else if (hubView) world?.focusHub();
  else world?.resetView();
  const state = world?.getJourneyState();
  if (hubView && state?.kind === 'hub' && state.arrived) renderAuthor();
  else renderDetail(toolId && (!world || !state.supported || (!state.moving && state.arrived && state.categoryId === categoryId)) ? tool : null);
}
function fallback(error) {
  if (error) console.warn('3D unavailable:', error.message);
  world?.destroy();
  world = null;
  $('world').hidden = true;
  $('explore').hidden = true;
  $('backup-browser').hidden = false;
  $('fallback').hidden = false;
  $('status').textContent = '工具清單仍可正常使用。';
  $('scene-help').textContent = '3D 目前無法使用，請使用下方備援分類與工具清單。';
  $('scene-secondary').hidden = true;
  if ($('detail').dataset.content === 'author') renderDetail(null);
  document.documentElement.dataset.world = 'fallback';
}
function probeWebGL() {
  if (new URLSearchParams(location.search).get('no3d') === '1') return false;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}
async function boot() {
  try {
    const response = await fetch('/tools.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`tools.json ${response.status}`);
    data = await response.json();
    if (!Array.isArray(data.categories) || !Array.isArray(data.tools)) throw new Error('Invalid tool data');
    for (const category of [{ id: '', label: '全部' }, ...data.categories]) {
      const button = el('button', category.label);
      button.type = 'button';
      button.dataset.category = category.id;
      button.onclick = () => navigate(category.id);
      $('categories').append(button);
    }
    route();
  } catch (error) {
    fallback(error);
    $('status').textContent = '工具清單載入失敗，請重新載入或回到工具總覽。';
    return;
  }
  if (!probeWebGL()) { fallback(); return; }
  try {
    const { createWorld } = await import('./world.js');
    world = createWorld({ container: $('world'), ...data,
      onSelectCategory: id => navigate(id), onSelectTool: (category, id) => navigate(category, id),
      onSelectPoint: point => {
        history.pushState({ pharmacyPoint: point }, '', location.pathname + location.search);
        route();
      }, onJourneyState: journeyChanged, onError: fallback });
    world.setPaused(document.hidden);
    $('explore').hidden = false;
    document.documentElement.dataset.world = 'ready';
    route();
  } catch (error) { fallback(error); }
}
$('overview').onclick = () => navigate();
$('explore').onclick = () => navigate(undefined, undefined, 'hub');
$('close-detail').onclick = () => {
  if ($('detail').dataset.content === 'author') { navigate(); $('explore').focus({ preventScroll: true }); }
  else navigate(selectedCategory);
};
$('retry').onclick = () => location.reload();
addEventListener('keydown', event => { if (event.key === 'Escape') navigate(); });
addEventListener('hashchange', route);
addEventListener('popstate', route);
document.addEventListener('visibilitychange', () => world?.setPaused(document.hidden));
addEventListener('pagehide', event => {
  if (event.persisted) world?.setPaused(true);
  else world?.destroy();
});
addEventListener('pageshow', event => {
  if (event.persisted) world?.setPaused(document.hidden);
});
$('browse-tools').onclick = () => {
  $('browser').scrollIntoView();
  $('browser').focus({ preventScroll: true });
};
boot();
