const $ = id => document.getElementById(id);
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
let data, world, selectedCategory, selectedTool, lastTrigger;
function navigate(category, tool) {
  lastTrigger = document.activeElement;
  const hash = category ? `#/${encodeURIComponent(category)}${tool ? '/' + encodeURIComponent(tool) : ''}` : '';
  history.pushState(null, '', location.pathname + location.search + hash);
  route();
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
  const content = $('detail-content');
  content.replaceChildren();
  if (!tool) {
    const wasOpen = !$('detail').hidden;
    $('detail').hidden = true;
    if (wasOpen) {
      const equivalent = lastTrigger?.dataset.tool && document.querySelector(`[data-tool="${CSS.escape(lastTrigger.dataset.tool)}"]`);
      (lastTrigger?.isConnected ? lastTrigger : equivalent || $('overview')).focus({ preventScroll: true });
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
  for (const button of $('categories').children) button.setAttribute('aria-pressed', String(button.dataset.category === (categoryId || '')));
  $('list-title').textContent = category?.label || '全部工具';
  const tools = categoryId ? data.tools.filter(item => item.category === categoryId) : data.tools;
  $('count').textContent = `${tools.length} 個工具`;
  $('tools').replaceChildren(...tools.map(item => {
    const button = el('button', null, 'tool-button');
    button.type = 'button';
    button.dataset.tool = item.id;
    button.append(el('strong', item.nameZh), el('small', item.name));
    button.onclick = () => navigate(item.category, item.id);
    return button;
  }));
  renderDetail(toolId ? tool : null);
  if (toolId) world?.focusTool(categoryId, toolId);
  else if (categoryId) world?.focusCategory(categoryId);
  else world?.resetView();
}
function fallback(error) {
  if (error) console.warn('3D unavailable:', error.message);
  world?.destroy();
  world = null;
  $('world').hidden = true;
  $('fallback').hidden = false;
  $('status').textContent = '工具清單仍可正常使用。';
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
      onSelectCategory: id => navigate(id), onSelectTool: (category, id) => navigate(category, id), onError: fallback });
    world.setPaused(document.hidden);
    if (selectedTool) world.focusTool(selectedCategory, selectedTool);
    else if (selectedCategory) world.focusCategory(selectedCategory);
    document.documentElement.dataset.world = 'ready';
    $('status').textContent = '3D 藥局已就緒 · 點選工作區或使用分類瀏覽工具。';
  } catch (error) { fallback(error); }
}
$('overview').onclick = () => navigate();
$('close-detail').onclick = () => navigate(selectedCategory);
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
