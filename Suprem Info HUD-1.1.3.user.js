// ==UserScript==
// @name         Suprem Info HUD
// @namespace    https://suprem.io/
// @version      1.1.3
// @description  Adds info HUD overlay (FPS, ping, network, position, velocity, health, ammo, K/D/damage, players) to suprem.io, with toggles integrated into the in-game settings menu.
// @author       MetalPipe (aka Mafiaman)
// @match        https://suprem.io/*
// @match        https://*.suprem.io/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var LS_KEY = 'srgInfoHud';
  var LS_POS = 'srgInfoHudPos';

  var settings = {
    enabled: true,
    fpsping: true,
    network: true,
    position: true,
    vitals: true,
    stats: true,
    players: true
  };

  try {
    var saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    for (var sk in saved) {
      if (Object.prototype.hasOwnProperty.call(settings, sk)) settings[sk] = !!saved[sk];
    }
  } catch (e) {}

  function saveSettings() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  var state = {
    fps: 0,
    gameFps: 0,
    gamePing: 0,
    hasGamePing: false
  };

  var net = {
    connected: false,
    sockets: 0,
    inBytes: 0,
    outBytes: 0,
    inMsgs: 0,
    outMsgs: 0,
    inRate: 0,
    outRate: 0,
    msgRate: 0
  };

  // ------------------------------------------------------------------
  // WebSocket hook (network stats)
  // ------------------------------------------------------------------
  function sizeOf(d) {
    if (d == null) return 0;
    if (typeof d === 'string') return d.length;
    if (typeof d === 'object') {
      if (typeof d.byteLength === 'number') return d.byteLength;
      if (typeof d.size === 'number') return d.size;
    }
    return 0;
  }

  (function hookWebSocket() {
    var Native = window.WebSocket;
    if (!Native || Native._srgHooked) return;
    function Wrapped(url, protocols) {
      var ws = arguments.length > 1 ? new Native(url, protocols) : new Native(url);
      try {
        ws.addEventListener('open', function () { net.connected = true; });
        ws.addEventListener('close', function () {
          net.sockets = Math.max(0, net.sockets - 1);
          if (net.sockets === 0) net.connected = false;
        });
        ws.addEventListener('error', function () { net.connected = false; });
        ws.addEventListener('message', function (ev) {
          net.inBytes += sizeOf(ev.data);
          net.inMsgs++;
        });
        var origSend = ws.send;
        ws.send = function (data) {
          net.outBytes += sizeOf(data);
          net.outMsgs++;
          return origSend.apply(ws, arguments);
        };
        net.sockets++;
      } catch (e) {}
      return ws;
    }
    Wrapped.prototype = Native.prototype;
    Wrapped.CONNECTING = Native.CONNECTING;
    Wrapped.OPEN = Native.OPEN;
    Wrapped.CLOSING = Native.CLOSING;
    Wrapped.CLOSED = Native.CLOSED;
    Wrapped._srgHooked = true;
    try { window.WebSocket = Wrapped; } catch (e) {}
  })();

  // ------------------------------------------------------------------
  // Module exports capture
  // ------------------------------------------------------------------
  var capturedExports = [];
  var origDefineProperty = Object.defineProperty;

  try {
    Object.defineProperty = function (target, prop, desc) {
      try {
        if (prop === '__esModule' && desc && desc.value === true && target && typeof target === 'object') {
          capturedExports.push(target);
        }
      } catch (e) {}
      return origDefineProperty.apply(this, arguments);
    };
  } catch (e) {}

  function findExports(test) {
    for (var i = 0; i < capturedExports.length; i++) {
      var o = capturedExports[i];
      try { if (test(o)) return o; } catch (e) {}
    }
    return null;
  }

  var globalsRef = null;
  var wrappedFps = null;
  var wrappedPing = null;

  function getGlobals() {
    if (globalsRef) return globalsRef;
    var m = findExports(function (o) {
      return Object.prototype.hasOwnProperty.call(o, 'globals') && o.globals && typeof o.globals === 'object';
    });
    if (m) globalsRef = m.globals;
    return globalsRef;
  }

  function getClient() {
    return findExports(function (o) {
      return Object.prototype.hasOwnProperty.call(o, 'roomSessionId');
    });
  }

  function getPlayerModule() {
    return findExports(function (o) {
      return Object.prototype.hasOwnProperty.call(o, 'players') && typeof o.findPlayerById === 'function';
    });
  }

  function wrapGameGlobals() {
    var g = getGlobals();
    if (!g || !g.gameWrapper) return;
    var gw = g.gameWrapper;
    try {
      if (typeof gw.setFps === 'function' && gw.setFps !== wrappedFps) {
        var of = gw.setFps;
        wrappedFps = function () {
          var v = arguments[0];
          if (typeof v === 'number' && isFinite(v)) state.gameFps = v;
          else if (v != null && isFinite(parseFloat(v))) state.gameFps = parseFloat(v);
          return of.apply(this, arguments);
        };
        gw.setFps = wrappedFps;
      }
      if (typeof gw.setPing === 'function' && gw.setPing !== wrappedPing) {
        var op = gw.setPing;
        wrappedPing = function () {
          var v = arguments[0];
          if (typeof v === 'number' && isFinite(v)) {
            state.gamePing = v;
            state.hasGamePing = true;
          }
          return op.apply(this, arguments);
        };
        gw.setPing = wrappedPing;
      }
    } catch (e) {}
  }

  // ------------------------------------------------------------------
  // Own FPS counter
  // ------------------------------------------------------------------
  (function () {
    var frames = 0;
    var last = performance.now();
    function tick() {
      frames++;
      var now = performance.now();
      if (now - last >= 1000) {
        state.fps = frames * 1000 / (now - last);
        frames = 0;
        last = now;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  // ------------------------------------------------------------------
  // Styles
  // ------------------------------------------------------------------
  function injectCss() {
    var css = document.createElement('style');
    css.textContent = [
      '#srg-hud{position:fixed;top:10px;left:10px;z-index:2147483000;',
      "font-family:'Oswald',Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif;",
      'font-size:12px;line-height:1.4;color:#fff;text-shadow:0 .08em .08em rgba(0,0,0,.85);',
      'background:rgba(0,0,0,.42);border-radius:.4em;padding:.35em .55em;min-width:10em;',
      'pointer-events:none;-webkit-user-select:none;user-select:none}',
      '#srg-hud .srg-head{cursor:move;pointer-events:auto;font-weight:bold;letter-spacing:.04em;',
      'border-bottom:.1em solid rgba(255,255,255,.2);margin-bottom:.2em;padding-bottom:.05em}',
      '#srg-hud .srg-section{margin-top:.15em}',
      '#srg-hud .srg-row{display:flex;justify-content:space-between;gap:1em;white-space:nowrap}',
      '#srg-hud .srg-key{color:#cfcfcf}',
      '#srg-hud .srg-val{font-weight:bold}',
      '#srg-hud .srg-good{color:#7dff7d}',
      '#srg-hud .srg-mid{color:#ffe066}',
      '#srg-hud .srg-bad{color:#ff6b6b}'
    ].join('');
    (document.head || document.documentElement).appendChild(css);
  }

  // ------------------------------------------------------------------
  // HUD DOM
  // ------------------------------------------------------------------
  var hud = null;
  var rows = {};

  function makeRow(key, label) {
    var row = document.createElement('div');
    row.className = 'srg-row';
    var k = document.createElement('span');
    k.className = 'srg-key';
    k.textContent = label;
    var v = document.createElement('span');
    v.className = 'srg-val';
    v.textContent = '--';
    row.appendChild(k);
    row.appendChild(v);
    rows[key] = v;
    return row;
  }

  function makeSection(name, items) {
    var sec = document.createElement('div');
    sec.className = 'srg-section';
    sec.setAttribute('data-srg-section', name);
    for (var i = 0; i < items.length; i++) {
      sec.appendChild(makeRow(items[i][0], items[i][1]));
    }
    return sec;
  }

  function buildHud() {
    if (hud) return;
    hud = document.createElement('div');
    hud.id = 'srg-hud';
    var head = document.createElement('div');
    head.className = 'srg-head';
    head.textContent = 'INFO HUD';
    hud.appendChild(head);
    hud.appendChild(makeSection('fpsping', [['fps', 'FPS'], ['ping', 'Ping']]));
    hud.appendChild(makeSection('network', [['down', 'Down'], ['up', 'Up'], ['msgs', 'Msgs']]));
    hud.appendChild(makeSection('position', [['pos', 'Pos'], ['vel', 'Vel']]));
    hud.appendChild(makeSection('vitals', [['hp', 'HP'], ['lives', 'Lives'], ['ammo', 'Ammo'], ['weapon', 'Weapon']]));
    hud.appendChild(makeSection('stats', [['kd', 'K / D'], ['dmg', 'DMG']]));
    hud.appendChild(makeSection('players', [['pcount', 'Players']]));
    (document.body || document.documentElement).appendChild(hud);

    try {
      var p = JSON.parse(localStorage.getItem(LS_POS) || 'null');
      if (p && typeof p.left === 'number' && typeof p.top === 'number') {
        hud.style.left = p.left + 'px';
        hud.style.top = p.top + 'px';
        hud.style.right = 'auto';
      }
    } catch (e) {}

    head.addEventListener('mousedown', function (e) {
      e.preventDefault();
      var rect = hud.getBoundingClientRect();
      var offX = e.clientX - rect.left;
      var offY = e.clientY - rect.top;
      function move(ev) {
        var left = Math.max(0, Math.min(window.innerWidth - 20, ev.clientX - offX));
        var top = Math.max(0, Math.min(window.innerHeight - 20, ev.clientY - offY));
        hud.style.left = left + 'px';
        hud.style.top = top + 'px';
      }
      function up() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        try {
          var r = hud.getBoundingClientRect();
          localStorage.setItem(LS_POS, JSON.stringify({ left: r.left, top: r.top }));
        } catch (err) {}
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });

    applyVisibility();
  }

  function applyVisibility() {
    if (hud) hud.style.display = settings.enabled ? 'block' : 'none';
    var secs = document.querySelectorAll('#srg-hud [data-srg-section]');
    for (var i = 0; i < secs.length; i++) {
      var name = secs[i].getAttribute('data-srg-section');
      secs[i].style.display = settings[name] ? 'block' : 'none';
    }
  }

  // ------------------------------------------------------------------
  // Settings menu integration
  // ------------------------------------------------------------------
  function buildOption(label, key) {
    var row = document.createElement('div');
    row.className = 'ui-input-wrapper ui-input-checkbox-wrapper';
    row.id = 'options-settings-option-srg-' + key;
    var lab = document.createElement('div');
    lab.className = 'ui-input-label noselect';
    lab.textContent = label;
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'ui-input-checkbox';
    cb.id = 'options-settings-option-checkmark-srg-' + key;
    cb.checked = !!settings[key];
    cb.addEventListener('change', function () {
      settings[key] = cb.checked;
      saveSettings();
      applyVisibility();
    });
    row.addEventListener('click', function (e) {
      if (e.target === cb) return;
      cb.checked = !cb.checked;
      settings[key] = cb.checked;
      saveSettings();
      applyVisibility();
    });
    row.appendChild(lab);
    row.appendChild(cb);
    return row;
  }

  function ensureSettingsMenu() {
    var w = document.getElementById('options-settings-wrapper');
    if (!w) return;
    if (w.querySelector('#srg-hud-settings-header')) return;
    var header = document.createElement('div');
    header.id = 'srg-hud-settings-header';
    header.className = 'options-settings-subheader';
    header.textContent = 'Info HUD';
    header.style.marginTop = '0.6em';
    w.appendChild(header);
    var items = [
      ['Enable Info HUD', 'enabled'],
      ['Show FPS & Ping', 'fpsping'],
      ['Show Network', 'network'],
      ['Show Position & Velocity', 'position'],
      ['Show Health & Ammo', 'vitals'],
      ['Show Stats (K/D/DMG)', 'stats'],
      ['Show Player Count', 'players']
    ];
    for (var i = 0; i < items.length; i++) {
      w.appendChild(buildOption(items[i][0], items[i][1]));
    }
  }

  // ------------------------------------------------------------------
  // Data + render
  // ------------------------------------------------------------------
  function fmt(n, d) {
    if (n == null || !isFinite(n)) return '--';
    return n.toFixed(d);
  }

  function rateClass(kbps, bad, mid) {
    if (kbps == null) return '';
    return kbps >= bad ? 'srg-bad' : (kbps >= mid ? 'srg-mid' : '');
  }

  var netPrev = { t: 0, inBytes: 0, outBytes: 0, inMsgs: 0, outMsgs: 0 };

  function updateNetRates() {
    var now = performance.now();
    if (!netPrev.t) {
      netPrev = { t: now, inBytes: net.inBytes, outBytes: net.outBytes, inMsgs: net.inMsgs, outMsgs: net.outMsgs };
      return;
    }
    var dt = (now - netPrev.t) / 1000;
    if (dt < 0.9) return;
    net.inRate = (net.inBytes - netPrev.inBytes) / dt;
    net.outRate = (net.outBytes - netPrev.outBytes) / dt;
    net.msgRate = (net.inMsgs - netPrev.inMsgs + net.outMsgs - netPrev.outMsgs) / dt;
    netPrev = { t: now, inBytes: net.inBytes, outBytes: net.outBytes, inMsgs: net.inMsgs, outMsgs: net.outMsgs };
  }

  function setVal(key, text, cls) {
    var el = rows[key];
    if (!el) return;
    el.textContent = text;
    el.className = 'srg-val' + (cls ? ' ' + cls : '');
  }

  function update() {
    wrapGameGlobals();
    updateNetRates();
    if (!hud) return;

    var fps = state.gameFps > 0 ? state.gameFps : state.fps;
    setVal('fps', fps ? String(Math.round(fps)) : '--', fps >= 55 ? 'srg-good' : (fps >= 30 ? 'srg-mid' : 'srg-bad'));
    setVal('ping', state.hasGamePing ? Math.round(state.gamePing) + 'ms' : '--',
      state.hasGamePing ? (state.gamePing < 80 ? 'srg-good' : (state.gamePing < 160 ? 'srg-mid' : 'srg-bad')) : '');

    setVal('down', (net.inRate / 1024).toFixed(1) + ' KB/s');
    setVal('up', (net.outRate / 1024).toFixed(1) + ' KB/s');
    setVal('msgs', net.msgRate.toFixed(0) + '/s');

    var client = getClient();
    var pm = getPlayerModule();
    var me = null;
    var players = null;
    if (pm && pm.players) {
      players = pm.players;
      if (client && client.roomSessionId) me = players[client.roomSessionId] || null;
    }

    if (me) {
      var sv = me.serverValues || {};
      setVal('pos', Math.round(sv.x) + ', ' + Math.round(sv.y));
      var spd = Math.sqrt((sv.velX || 0) * (sv.velX || 0) + (sv.velY || 0) * (sv.velY || 0));
      setVal('vel', fmt(spd, 1));

      var hp = typeof me.health === 'number' ? me.health : null;
      setVal('hp', hp == null ? '--' : String(Math.round(hp)), hp == null ? '' : (hp > 60 ? 'srg-good' : (hp > 25 ? 'srg-mid' : 'srg-bad')));
      setVal('lives', me.lives == null ? '--' : String(me.lives));
      setVal('ammo', me.ammo == null ? '--' : String(me.ammo));
      setVal('weapon', me.displayWeapon ? String(me.displayWeapon) : '--');

      var st = me.stats || {};
      setVal('kd', (st.kills || 0) + ' / ' + (st.deaths || 0));
      setVal('dmg', (st.damageDealt || 0) + ' / ' + (st.damageTaken || 0));
    } else {
      setVal('pos', '--');
      setVal('vel', '--');
      setVal('hp', '--');
      setVal('lives', '--');
      setVal('ammo', '--');
      setVal('weapon', '--');
      setVal('kd', '--');
      setVal('dmg', '--');
    }

    if (players) {
      setVal('pcount', String(Object.keys(players).length));
    } else {
      setVal('pcount', '--');
    }
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  function boot() {
    injectCss();
    buildHud();
    var mo = new MutationObserver(function () { ensureSettingsMenu(); });
    try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
    setInterval(ensureSettingsMenu, 1000);
    setInterval(update, 100);
    update();
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
