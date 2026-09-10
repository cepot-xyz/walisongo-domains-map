const Graph = (() => {
  let WIDTH = window.innerWidth;
  let HEIGHT = window.innerHeight;
  const ROOT_RADIUS = 40;
  const NODE_RADIUS = 6;
  const DEAD_RADIUS = 4;
  const FOCAL = 850;
  const SPHERE_R = 300;
  const JITTER_R = SPHERE_R * 0.2;
  const RESUME_DELAY = 3000;
  const TRACK_ZOOM = 3;
  const PULL_DEPTH = 70;
  const FAC_COLOR = '#00d5ff';
  const FACULTY = new Set([
    'fakdakom', 'febi', 'feis', 'fisip', 'fitk', 'fk',
    'fpk', 'fs', 'fsh', 'fst', 'fuhum'
  ]);
  const CORE_COLOR = '#ff5252';
  const INFO_COLOR = '#d7ff50';
  const CORE_SYSTEMS = new Set([
    'akademik', 'sso', 'siremun', 'simahad'
  ]);
  const PRODI_COLOR = '#bb86fc';
  const PRODI = new Set([
    'pai', 'pba', 'pbi', 'pgmi', 'piaud', 'mpi',
    'kpi', 'md', 'pmi', 'mhu',
    'ei-febi', 'aks-febi', 'pbs-febi', 'mnj-febi', 'bisnisdigital', 's2es-febi',
    'hes', 'hpi', 'hki', 'ih', 'if', 's2-if', 's2-ih',
    'iat', 'saa', 's2iat', 's2-iai',
    'ti', 'biologi', 'kimia', 'fisika', 'matematika', 'tekling',
    'pendidikanbiologi', 'pendidikanfisika', 'pendidikankimia', 'pendidikanmatematika',
    's2paifitk', 's2-pba', 's2kpi'
  ]);

  const STATE = {
    angle: 0,
    speed: 0.12,
    currentSpeed: 0,
    spread: 1.3,
    tilt: 0.22,
    zoom: 0.8,
    interacting: 0,
    dragging: false,
    resumeAt: 0,
    tracking: null,
    pull: 0,
    baseZoom: 0.8,
    zoomAnim: null,
    groups: { core: true, info: true, prodi: true, fac: true, other: true }
  };

  let svg, g;
  let nodes = [], links = [];
  let overlay = null;
  let overlayCloseTimer = null;
  let trackBadge = null;
  const bgPointers = new Map();
  let singleDrag = null;
  let pinchStart = null;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function init() {
    buildData();
    createSVG();
    renderElements();
    setupInteractions();
    createOverlay();
    createSearchControl();
    createSidebar();
    applyTransform();
    requestAnimationFrame(mainLoop);
  }

  function buildData() {
    nodes.push(rootNode());

    const seen = new Set();
    const catKeys = Object.keys(CATEGORIES);
    const centroids = catKeys.map((_, i) => fibPoint(i, catKeys.length, SPHERE_R));

    SUBDOMAINS.forEach(d => {
      if (d.dedup) return;
      const key = d.sub + '.' + ROOT_DOMAIN;
      if (seen.has(key)) return;
      seen.add(key);

      const isActive = d.status === 'active';
      const ci = Math.max(0, catKeys.indexOf(d.cat));
      const c = centroids[ci];
      const isProdi = PRODI.has(d.sub);
      const radial = isProdi
        ? 1.34 + Math.random() * 0.33
        : 0.8 + Math.random() * 0.45;

      nodes.push({
        id: key,
        full: key,
        label: d.sub,
        type: isActive ? 'active' : 'dead',
        status: d.status,
        category: d.cat,
        catName: CATEGORIES[d.cat]?.name || d.cat,
        fac: FACULTY.has(d.sub),
        core: CORE_SYSTEMS.has(d.sub),
        info: d.cat === 'O',
        prodi: PRODI.has(d.sub),
        desc: d.desc,
        radius: isActive ? NODE_RADIUS : DEAD_RADIUS,
        url: 'https://' + key,
        baseX: c.x * radial + (Math.random() * 2 - 1) * JITTER_R,
        baseY: c.y * radial + (Math.random() * 2 - 1) * JITTER_R,
        baseZ: c.z * radial + (Math.random() * 2 - 1) * JITTER_R
      });

      links.push({
        source: ROOT_DOMAIN,
        target: key
      });
    });

    links.forEach(l => {
      l.source = nodes.find(n => n.id === l.source);
      l.target = nodes.find(n => n.id === l.target);
    });
  }

  function rootNode() {
    return {
      id: ROOT_DOMAIN,
      full: ROOT_DOMAIN,
      type: 'root',
      status: 'root',
      radius: ROOT_RADIUS,
      desc: 'Main official website, portal berita & informasi UIN Walisongo Semarang. WordPress 6.5.5, menghosting berita universitas, pengumuman, dan link ke semua sistem (akademik, PMB, SSO, fakultas, dll).',
      url: 'https://' + ROOT_DOMAIN,
      baseX: 0,
      baseY: 0,
      baseZ: 0
    };
  }

  function fibPoint(i, n, R) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const theta = golden * i;
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    return { x: Math.cos(theta) * rad * R, y: y * R, z: Math.sin(theta) * rad * R };
  }

  function createSVG() {
    svg = d3.select('#graph-container')
      .append('svg')
      .attr('width', WIDTH)
      .attr('height', HEIGHT);

    g = svg.append('g');

    const svgEl = svg.node();
    svg.on('wheel', e => {
      e.preventDefault();
      STATE.zoom = clamp(STATE.zoom * Math.exp(-e.deltaY * 0.0025), 0.05, 6);
      applyTransform();
    })
    .on('pointerdown', onBgPointerDown)
    .on('pointermove', onBgPointerMove)
    .on('pointerup', onBgPointerUp)
    .on('pointercancel', onBgPointerUp);
  }

  function onBgPointerDown(e) {
    if (e.target !== svg.node()) return;
    bgPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    STATE.interacting++;
    svg.node().setPointerCapture(e.pointerId);

    if (bgPointers.size === 1) {
      singleDrag = {
        x: e.clientX,
        y: e.clientY,
        angle: STATE.angle,
        tilt: STATE.tilt
      };
    } else if (bgPointers.size === 2) {
      const pts = [...bgPointers.values()];
      pinchStart = {
        d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        a0: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x),
        zoom0: STATE.zoom,
        angle0: STATE.angle,
        tilt0: STATE.tilt
      };
      singleDrag = null;
    }
  }

  function onBgPointerMove(e) {
    if (!bgPointers.has(e.pointerId)) return;
    bgPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (bgPointers.size === 1 && singleDrag) {
      const dx = e.clientX - singleDrag.x;
      const dy = e.clientY - singleDrag.y;
      STATE.angle = singleDrag.angle - dx * 0.006;
      STATE.tilt = clamp(singleDrag.tilt + dy * 0.004, -1.2, 1.2);
    } else if (bgPointers.size === 2 && pinchStart) {
      const pts = [...bgPointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const a = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      STATE.zoom = clamp(pinchStart.zoom0 * (1 + (d / pinchStart.d0 - 1) * 2.5), 0.05, 6);
      STATE.angle = pinchStart.angle0 - (a - pinchStart.a0) * 0.9;
      applyTransform();
    }
  }

  function onBgPointerUp(e) {
    if (!bgPointers.has(e.pointerId)) return;
    bgPointers.delete(e.pointerId);
    STATE.interacting = Math.max(0, STATE.interacting - 1);

    if (bgPointers.size === 1) {
      const p = [...bgPointers.values()][0];
      singleDrag = { x: p.x, y: p.y, angle: STATE.angle, tilt: STATE.tilt };
    } else {
      singleDrag = null;
    }
    pinchStart = null;

    if (bgPointers.size === 0) {
      STATE.resumeAt = performance.now() + (STATE.tracking ? 400 : RESUME_DELAY);
    }
  }

  function applyTransform() {
    g.attr('transform', 'translate(' + WIDTH / 2 + ',' + HEIGHT / 2 + ') scale(' + STATE.zoom + ')');
  }

  function currentTilt() {
    return STATE.tilt + (STATE.tracking ? 0 : Math.sin(STATE.angle * 0.5) * 0.05);
  }

  function project(d) {
    const s = STATE.spread;
    const rx = d.baseX * s;
    const ry = d.baseY * s;
    const rz = d.baseZ * s;
    const ca = Math.cos(STATE.angle);
    const sa = Math.sin(STATE.angle);
    const cx = rx * ca + rz * sa;
    const cz = -rx * sa + rz * ca;
    const tilt = currentTilt();
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const ty = ry * ct - cz * st;
    const tz = ry * st + cz * ct;
    let fx = cx;
    let fy = ty;
    let fz = tz;
    if (d.id === STATE.tracking && STATE.pull > 0) {
      const k = STATE.pull;
      fx = cx * (1 - k);
      fy = ty * (1 - k);
      fz = tz * (1 - k) + PULL_DEPTH * k;
    }
    const scale = FOCAL / (FOCAL + fz);
    return { x: fx * scale, y: fy * scale, scale, z: fz };
  }

  function unprojectToBase(sx, sy, fixedZ) {
    const ca = Math.cos(STATE.angle);
    const sa = Math.sin(STATE.angle);
    const tilt = currentTilt();
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const A = fixedZ * STATE.spread;
    let rx = sx;
    let ry = sy;
    for (let i = 0; i < 8; i++) {
      const cz = -rx * sa + A * ca;
      const cx = rx * ca + A * sa;
      const ty = ry * ct - cz * st;
      const tz = ry * st + cz * ct;
      const sc = FOCAL / (FOCAL + tz);
      const pxx = cx * sc;
      const pyy = ty * sc;
      rx += (sx - pxx) / Math.max(0.15, Math.abs(ca) * sc);
      ry += (sy - pyy) / Math.max(0.15, Math.abs(ct) * sc);
    }
    return { x: rx / STATE.spread, y: ry / STATE.spread };
  }

  function angleDelta(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function easeT(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function stepZoomAnim(dt) {
    if (!STATE.zoomAnim) return;
    STATE.zoomAnim.t = Math.min(1, STATE.zoomAnim.t + dt * 0.7);
    const f = easeT(STATE.zoomAnim.t);
    STATE.zoom = STATE.zoomAnim.from + (STATE.zoomAnim.to - STATE.zoomAnim.from) * f;
    if (STATE.zoomAnim.t >= 1) STATE.zoomAnim = null;
  }

  function renderElements() {
    const activeNodes = nodes.filter(n => n.type === 'active');
    const deadNodes = nodes.filter(n => n.type === 'dead');
    const rootNode = nodes.find(n => n.type === 'root');

    g.append('g').attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('class', 'link-line');

    g.append('circle')
      .datum(rootNode)
      .attr('id', 'root-circle')
      .attr('r', ROOT_RADIUS)
      .attr('fill', '#ffffff')
      .attr('class', 'node node-root')
      .on('click', (e, d) => {
        if (e.defaultPrevented) return;
        showOverlay(d);
      });

    g.append('circle')
      .attr('id', 'track-highlight')
      .attr('fill', 'none')
      .attr('stroke', '#5ff057')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 4')
      .style('display', 'none');

    g.append('text')
      .datum(rootNode)
      .attr('id', 'root-label')
      .text(ROOT_DOMAIN)
      .attr('font-size', 11)
      .attr('fill', '#121212')
      .attr('text-anchor', 'middle')
      .attr('dy', 4.5)
      .attr('pointer-events', 'none')
      .attr('font-weight', '600');

    g.append('g').attr('class', 'nodes-dead')
      .selectAll('circle')
      .data(deadNodes)
      .join('circle')
      .attr('r', d => d.radius)
      .attr('fill', '#333333')
      .attr('stroke', '#555555')
      .attr('stroke-width', 0.5)
      .attr('class', 'node node-dead')
      .on('click', (e, d) => {
        if (e.defaultPrevented) return;
        showOverlay(d);
      })
      .call(d3.drag()
        .on('start', dragStart)
        .on('drag', dragging)
        .on('end', dragEnd));

    g.append('g').attr('class', 'nodes-active')
      .selectAll('g')
      .data(activeNodes)
      .join('g')
      .attr('class', 'node node-active')
      .on('click', (e, d) => {
        if (e.defaultPrevented) return;
        showOverlay(d);
      })
      .call(d3.drag()
        .on('start', dragStart)
        .on('drag', dragging)
        .on('end', dragEnd))
      .each(function() {
        d3.select(this)
          .append('circle')
          .attr('class', 'node-core')
          .attr('fill', d => d.core ? CORE_COLOR : d.info ? INFO_COLOR : d.prodi ? PRODI_COLOR : d.fac ? FAC_COLOR : '#5ff057')
          .attr('stroke', d => d.core ? CORE_COLOR : d.info ? INFO_COLOR : d.prodi ? PRODI_COLOR : d.fac ? FAC_COLOR : '#d7ff50')
          .attr('stroke-width', 0.8);
      });

    g.append('g').attr('class', 'labels-active')
      .selectAll('text')
      .data(activeNodes)
      .join('text')
      .text(d => d.label)
      .attr('font-size', 8)
      .attr('fill', d => d.core || d.info || d.prodi || d.fac ? '#ffffff' : '#d7ff50')
      .attr('text-anchor', 'middle')
      .attr('dy', -10)
      .attr('pointer-events', 'none')
      .attr('class', 'node-label');

    g.append('g').attr('class', 'labels-dead')
      .selectAll('text')
      .data(deadNodes)
      .join('text')
      .text(d => d.label)
      .attr('font-size', 7)
      .attr('fill', '#ffffff')
      .attr('text-anchor', 'middle')
      .attr('dy', -9)
      .attr('opacity', 0.7)
      .attr('pointer-events', 'none')
      .attr('class', 'node-label');
  }

  function getNode(id) {
    const k = typeof id === 'object' ? id.id : id;
    return nodes.find(n => n.id === k);
  }

  function isGroupVisible(node) {
    if (node.type === 'root') return true;
    if (node.core && !STATE.groups.core) return false;
    if (node.info && !STATE.groups.info) return false;
    if (node.prodi && !STATE.groups.prodi) return false;
    if (node.fac && !STATE.groups.fac) return false;
    if (!node.core && !node.info && !node.prodi && !node.fac && !STATE.groups.other) return false;
    return true;
  }

  function createSidebar() {
    const legendData = [
      { color: CORE_COLOR, label: 'Core Systems' },
      { color: INFO_COLOR, label: 'Information Systems' },
      { color: PRODI_COLOR, label: 'Prodi' },
      { color: FAC_COLOR, label: 'Faculty' },
      { color: '#5ff057', label: 'Others' },
      { color: '#555555', label: 'Dead / Error' }
    ];
    const filterData = [
      { key: 'core', label: 'Core Systems', color: CORE_COLOR },
      { key: 'info', label: 'Information Systems', color: INFO_COLOR },
      { key: 'prodi', label: 'Prodi', color: PRODI_COLOR },
      { key: 'fac', label: 'Faculty', color: FAC_COLOR },
      { key: 'other', label: 'Others', color: '#5ff057' }
    ];

    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar';
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <span class="sidebar-title">WALISONGO DOMAIN MAP</span>
        <button class="sidebar-close">&times;</button>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-heading">Stats</div>
        <div class="sidebar-stats" id="sidebar-stats"></div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-heading">Legend</div>
        <div id="sidebar-legend"></div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-heading">Filter</div>
        <div id="sidebar-filters"></div>
      </div>
    `;
    document.body.appendChild(sidebar);

    const legendEl = sidebar.querySelector('#sidebar-legend');
    legendData.forEach(item => {
      const div = document.createElement('div');
      div.className = 'legend-item';
      div.innerHTML = '<span class="legend-dot" style="background:' + item.color + '"></span>' + item.label;
      legendEl.appendChild(div);
    });

    const filtersEl = sidebar.querySelector('#sidebar-filters');
    filterData.forEach(item => {
      const label = document.createElement('label');
      label.className = 'filter-item';
      label.innerHTML = '<input type="checkbox" checked data-group="' + item.key + '"><span class="legend-dot" style="background:' + item.color + '"></span>' + item.label;
      label.querySelector('input').addEventListener('change', e => {
        STATE.groups[item.key] = e.target.checked;
      });
      filtersEl.appendChild(label);
    });

    const active = nodes.filter(n => n.type === 'active').length;
    const dead = nodes.filter(n => n.status === 'dead').length;
    const err = nodes.filter(n => n.status === 'error').length;
    sidebar.querySelector('#sidebar-stats').innerHTML =
      '<div>Total: <span class="stat-val">' + (nodes.length - 1) + '</span></div>' +
      '<div>Active: <span class="stat-val">' + active + '</span></div>' +
      '<div>Dead: <span class="stat-val">' + dead + '</span></div>' +
      '<div>Error: <span class="stat-val">' + err + '</span></div>';

    const hamburger = document.createElement('button');
    hamburger.id = 'hamburger';
    hamburger.className = 'hamburger';
    hamburger.innerHTML = '&#9776;';
    document.body.appendChild(hamburger);

    const backdrop = document.createElement('div');
    backdrop.id = 'sidebar-backdrop';
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);

    sidebar.querySelector('.sidebar-close').addEventListener('click', () => toggleSidebar(false));
    hamburger.addEventListener('click', () => toggleSidebar(!sidebar.classList.contains('open')));
    backdrop.addEventListener('click', () => toggleSidebar(false));
  }

  function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const input = document.getElementById('search-input');
    if (open) {
      sidebar.classList.add('open');
      backdrop.classList.add('visible');
      if (input) setTimeout(() => input.focus(), 300);
      history.pushState({ sidebar: true }, '');
    } else {
      sidebar.classList.remove('open');
      backdrop.classList.remove('visible');
      if (input) input.blur();
    }
  }

  function mainLoop(now) {
    if (!STATE.lastTime) STATE.lastTime = now;
    const dt = Math.min(0.05, (now - STATE.lastTime) / 1000);
    STATE.lastTime = now;

    let targetSpeed = 0;
    if (STATE.interacting === 0 && !STATE.dragging && now >= STATE.resumeAt) {
      targetSpeed = STATE.speed;
    }
    STATE.currentSpeed += (targetSpeed - STATE.currentSpeed) * Math.min(1, dt * 3);
    if (Math.abs(STATE.currentSpeed) < 0.0002) STATE.currentSpeed = 0;
    STATE.angle += STATE.currentSpeed * dt;

    if (STATE.tracking) {
      const pullTarget = 1;
      STATE.pull += (pullTarget - STATE.pull) * Math.min(1, dt * 3.5);
    } else if (STATE.pull > 0) {
      STATE.pull += (0 - STATE.pull) * Math.min(1, dt * 3.5);
      if (Math.abs(STATE.pull) < 0.001) STATE.pull = 0;
    }

    if (STATE.zoomAnim) stepZoomAnim(dt);
    applyTransform();

    updatePositions();
    requestAnimationFrame(mainLoop);
  }

  function updatePositions() {
    g.selectAll('.links line')
      .each(function(d) {
        const a = project(d.source);
        const b = project(d.target);
const target = getNode(d.target);
      const dead = target && target.type === 'dead';
      const linkColor = target ? (target.core ? CORE_COLOR : target.info ? INFO_COLOR : target.prodi ? PRODI_COLOR : target.fac ? FAC_COLOR : dead ? '#555555' : '#d7ff50') : '#555555';
      d3.select(this)
        .attr('x1', a.x).attr('y1', a.y)
        .attr('x2', b.x).attr('y2', b.y)
        .attr('stroke', linkColor)
        .attr('stroke-opacity', dead ? 0.35 : 0.35)
        .attr('stroke-width', 0.5);
      });

    g.select('#root-circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .style('display', !!STATE.tracking ? 'none' : null);

    g.select('#root-label')
      .attr('x', 0)
      .attr('y', 0)
      .style('display', !!STATE.tracking ? 'none' : null);

    const trk = STATE.tracking ? nodes.find(n => n.id === STATE.tracking) : null;
    const dim = !!STATE.tracking;
    const trackedId = STATE.tracking;
    const occludedByRoot = p => !dim && p.z > 0 && (p.x * p.x + p.y * p.y) < ROOT_RADIUS * ROOT_RADIUS;
    if (trk) {
      const p = project(trk);
      d3.select('#track-highlight')
        .attr('cx', p.x)
        .attr('cy', p.y)
        .attr('r', (trk.radius * 3 + 12) * p.scale)
        .style('display', null);
    } else {
      d3.select('#track-highlight').style('display', 'none');
    }

    g.selectAll('.nodes-dead circle').each(function(d) {
      const p = project(d);
      const emph = d.id === trackedId ? 3 : 1;
      const hidden = occludedByRoot(p) || !isGroupVisible(d);
      d3.select(this)
        .attr('cx', p.x).attr('cy', p.y)
        .attr('r', d.radius * p.scale * emph)
        .style('display', hidden ? 'none' : null)
        .style('opacity', dim && d.id !== trackedId ? 0.12 : null);
    });

    g.selectAll('.node-active').each(function(d) {
      const p = project(d);
      const emph = d.id === trackedId ? 3 : 1;
      const hidden = occludedByRoot(p) || !isGroupVisible(d);
      d3.select(this)
        .attr('transform', 'translate(' + p.x + ',' + p.y + ')')
        .style('display', hidden ? 'none' : null)
        .select('.node-core')
        .attr('r', d.radius * p.scale * emph)
        .style('opacity', dim && d.id !== trackedId ? 0.25 : null);
    });

    g.selectAll('.node-label')
      .attr('x', d => project(d).x)
      .attr('y', d => project(d).y)
      .attr('font-size', d => (d.type === 'active' ? 8 : 7) * project(d).scale)
      .style('opacity', d => dim && d.id !== trackedId ? 0.18 : null)
      .style('display', d => {
        const p = project(d);
        return (occludedByRoot(p) || !isGroupVisible(d)) ? 'none' : null;
      });

    g.selectAll('.link-line')
      .each(function(d) {
        const target = d.target;
        const hidden = !isGroupVisible(target);
        d3.select(this)
          .style('stroke-opacity', hidden ? 0 : (dim ? 0.06 : null));
      });
  }

  function dragStart() {
    STATE.dragging = true;
  }

  function dragging(e, d) {
    const p = unprojectToBase(e.x, e.y, d.baseZ);
    d.baseX = p.x;
    d.baseY = p.y;
  }

  function dragEnd() {
    STATE.dragging = false;
    STATE.resumeAt = performance.now() + (STATE.tracking ? 400 : RESUME_DELAY);
  }

  function setupInteractions() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const sb = document.getElementById('sidebar');
        if (sb && sb.classList.contains('open')) {
          toggleSidebar(false);
        } else if (overlay && !overlay.classList.contains('hidden')) {
          closeOverlay();
        } else {
          exitTracking();
        }
      }
    });

    window.addEventListener('popstate', () => {
      const sb = document.getElementById('sidebar');
      if (sb && sb.classList.contains('open')) {
        toggleSidebar(false);
        return;
      }
      if (overlay && !overlay.classList.contains('hidden')) {
        closeOverlay();
        return;
      }
      exitTracking();
    });

    document.addEventListener('contextmenu', e => e.preventDefault());

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        WIDTH = window.innerWidth;
        HEIGHT = window.innerHeight;
        svg.attr('width', WIDTH).attr('height', HEIGHT);
      }, 100);
    });
  }

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.className = 'overlay hidden';
    overlay.innerHTML = `
      <div class="overlay-box">
        <div class="overlay-header">
          <span class="overlay-title"></span>
          <button class="overlay-close" aria-label="Close">&times;</button>
        </div>
        <div class="overlay-body">
          <p class="overlay-desc"></p>
          <div class="overlay-meta"></div>
        </div>
        <div class="overlay-footer">
          <a class="overlay-visit" href="#" target="_blank" rel="noopener">Kunjungi</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeOverlay();
    });

    overlay.querySelector('.overlay-close').addEventListener('click', closeOverlay);
  }

  function createSearchControl() {
    const wrap = document.createElement('form');
    wrap.id = 'search-control';
    wrap.innerHTML = `
      <input id="search-input" type="text" placeholder="Cari subdomain..." autocomplete="off" enterkeyhint="search">
      <button id="search-btn" type="submit">Track</button>
      <div id="search-results"></div>
    `;
    document.body.appendChild(wrap);

    const input = wrap.querySelector('#search-input');
    const results = wrap.querySelector('#search-results');

    trackBadge = document.createElement('div');
    trackBadge.id = 'track-badge';
    trackBadge.className = 'hidden';
    trackBadge.innerHTML = `
      <span>Tracking: <b></b></span>
      <button type="button" aria-label="Stop tracking">&times;</button>
    `;
    document.body.appendChild(trackBadge);
    trackBadge.querySelector('button').addEventListener('click', exitTracking);

    function matchNodes(q) {
      const lowerQ = q.trim().toLowerCase();
      if (!lowerQ) return [];
      return nodes
        .filter(n => n.type !== 'root' && n.full.toLowerCase().includes(lowerQ))
        .sort((a, b) => {
          const ap = a.label.toLowerCase().startsWith(lowerQ) ? 1 : 0;
          const bp = b.label.toLowerCase().startsWith(lowerQ) ? 1 : 0;
          if (ap !== bp) return bp - ap;
          return a.label.length - b.label.length;
        })
        .slice(0, 8);
    }

    function bestMatch(q) {
      const m = matchNodes(q);
      return m.length ? m[0] : null;
    }

    function renderResults(query) {
      const q = query.trim().toLowerCase();
      if (!q) {
        results.innerHTML = '';
        results.classList.remove('visible');
        return;
      }
      const matches = matchNodes(q);
      if (!matches.length) {
        results.innerHTML = '<div class="result-nodata">Tidak ada hasil</div>';
      } else {
        results.innerHTML = '';
        matches.forEach(n => {
          const item = document.createElement('div');
          item.className = 'result-item';
          item.innerHTML = '<span>' + n.full + '</span><span class="cat">' + n.catName + '</span>';
          item.addEventListener('click', () => {
            setTracking(n);
            hideResults();
          });
          results.appendChild(item);
        });
      }
      results.classList.add('visible');
    }

    function hideResults() {
      results.classList.remove('visible');
      results.innerHTML = '';
    }

    input.addEventListener('input', () => renderResults(input.value));
    input.addEventListener('focus', () => renderResults(input.value));
    input.addEventListener('blur', () => {
      setTimeout(hideResults, 150);
    });
    wrap.addEventListener('submit', e => {
      e.preventDefault();
      const found = bestMatch(input.value);
      if (found) {
        setTracking(found);
        hideResults();
        input.value = '';
        input.blur();
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hideResults();
    });

    document.addEventListener('keydown', e => {
      if (overlay && !overlay.classList.contains('hidden')) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k.length !== 1 || k === ' ') return;
      e.preventDefault();
      input.focus();
      input.value += k;
      input.setSelectionRange(input.value.length, input.value.length);
      renderResults(input.value);
    });
  }

  function setTracking(node) {
    STATE.tracking = node.id;
    STATE.baseZoom = STATE.zoom;
    STATE.zoomAnim = { from: STATE.zoom, to: clamp(TRACK_ZOOM, 0.05, 6), t: 0 };
    trackBadge.querySelector('b').textContent = node.full;
    trackBadge.classList.remove('hidden');
    history.pushState({ tracking: true }, '');
  }

  function exitTracking() {
    if (!STATE.tracking) return;
    STATE.tracking = null;
    trackBadge.classList.add('hidden');
    STATE.zoomAnim = { from: STATE.zoom, to: STATE.baseZoom, t: 0 };
    STATE.resumeAt = performance.now() + 1200;
  }

  function showOverlay(d) {
    const title = overlay.querySelector('.overlay-title');
    const desc = overlay.querySelector('.overlay-desc');
    const meta = overlay.querySelector('.overlay-meta');
    const visit = overlay.querySelector('.overlay-visit');

    title.textContent = d.id;
    desc.textContent = d.desc || '';
    meta.innerHTML = `
      <span class="meta-tag">${d.type === 'root' ? 'Root Domain' : d.catName || ''}</span>
      <span class="meta-tag meta-status-${d.status || 'root'}">${
        d.status === 'active' ? 'Active' :
        d.status === 'dead' ? 'Dead' :
        d.status === 'error' ? 'Error' : 'Root'
      }</span>
    `;
    visit.href = d.url || '#';
    clearTimeout(overlayCloseTimer);
    overlay.classList.remove('hidden');
    void overlay.offsetWidth;
    overlay.classList.add('visible');
    history.pushState({ overlay: true }, '');
  }

  function closeOverlay() {
    if (!overlay || overlay.classList.contains('hidden')) return;
    overlay.classList.remove('visible');
    clearTimeout(overlayCloseTimer);
    overlayCloseTimer = setTimeout(() => {
      overlay.classList.add('hidden');
    }, 260);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', Graph.init);