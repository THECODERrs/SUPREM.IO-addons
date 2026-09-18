// ==UserScript==
// @name         Suprem Custom Match Maker
// @namespace    https://suprem.io/
// @version      1.3.0
// @description  Create custom private match codes on suprem.io. "na" is prefixed automatically.
// @author       MetalPipe (aka mafiaman)
// @match        *://*.suprem.io/*
// @match        *://suprem.io/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      na.suprem.io
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    if (window.__supremMatchMakerLoaded) return;
    window.__supremMatchMakerLoaded = true;

    var API = 'https://na.suprem.io/matchmake/create/private';
    var PREFIX = 'na';
    var VOLUME_BUTTON_ID = 'menu-volume-button';

    var LOCK_MASK = 'url(data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%3E%3Cpath%20fill=%22%23fff%22%20d=%22M12%202a5%205%200%200%200-5%205v3H6a2%202%200%200%200-2%202v8a2%202%200%200%200%202%202h12a2%202%200%200%200%202-2v-8a2%202%200%200%200-2-2h-1V7a5%205%200%200%200-5-5zm-3%208V7a3%203%200%200%201%206%200v3H9z%22/%3E%3C/svg%3E)';

    GM_addStyle(
        '#scm-root, #scm-root * { box-sizing: border-box; margin: 0; padding: 0; }' +
        '#scm-root {' +
            'font-family: "Oswald", Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;' +
            'color: #fff;' +
            'text-shadow: 0 0.06em 0.2em rgba(0,0,0,0.9);' +
            'user-select: none; -webkit-user-select: none;' +
            '-webkit-touch-callout: none;' +
        '}' +
        '#scm-fab {' +
            'position: fixed;' +
            'right: 14.5em;' +
            'bottom: 1em;' +
            'width: 3.5em;' +
            'height: 3.5em;' +
            'background-color: var(--button-red-color, rgb(200,30,30));' +
            'border: none;' +
            'border-bottom: 0.3em solid rgba(0,0,0,0.15);' +
            'margin-bottom: -0.3em;' +
            'border-radius: 0.5em;' +
            'padding: 0;' +
            'cursor: pointer;' +
            'z-index: 2147483645;' +
            'transition: 0.1s ease;' +
            'transition-property: background-color;' +
            'touch-action: none;' +
        '}' +
        '#scm-fab.scm-docked { position: absolute; }' +
        '#scm-fab:hover { background-color: var(--button-special-hover-color, rgb(180,20,20)); }' +
        '#scm-fab:active { background-color: var(--button-special-active-color, rgb(160,20,20)); }' +
        '#scm-fab > div {' +
            'width: inherit;' +
            'height: 3em;' +
            'position: relative;' +
            'top: calc(50% - 1.5em);' +
            'background-color: white;' +
            'mask-image: ' + LOCK_MASK + ';' +
            '-webkit-mask-image: ' + LOCK_MASK + ';' +
            'mask-repeat: no-repeat;' +
            '-webkit-mask-repeat: no-repeat;' +
            'mask-position: center center;' +
            '-webkit-mask-position: center center;' +
            'mask-size: 80%;' +
            '-webkit-mask-size: 80%;' +
        '}' +
        '#scm-panel {' +
            'position: fixed;' +
            'z-index: 2147483647;' +
            'width: 300px;' +
            'max-width: calc(100vw - 24px);' +
            'background-color: rgba(12,10,16,0.72);' +
            'backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);' +
            'border-radius: 0.5em;' +
            'box-shadow: 0 0.25em 1.25em rgba(0,0,0,0.55), 0 0 0 0.05em rgba(255,255,255,0.08);' +
            'overflow: hidden;' +
        '}' +
        '#scm-panel[hidden] { display: none; }' +
        '#scm-head {' +
            'display: flex; align-items: center; justify-content: space-between;' +
            'padding: 0.6em 1em;' +
            'border-bottom: 0.1em solid rgba(255,255,255,0.2);' +
        '}' +
        '#scm-title {' +
            'font-size: 1.2em;' +
            'font-weight: bold;' +
            'letter-spacing: 0.04em;' +
            'text-transform: uppercase;' +
        '}' +
        '#scm-close {' +
            'position: relative;' +
            'width: 1.5em; height: 1.5em;' +
            'opacity: 0.55;' +
            'cursor: pointer;' +
            'transition: opacity 0.1s ease;' +
        '}' +
        '#scm-close:hover { opacity: 1; }' +
        '#scm-close::before, #scm-close::after {' +
            'content: " ";' +
            'position: absolute;' +
            'left: 0.68em; top: 0.2em;' +
            'height: 1.1em; width: 0.15em;' +
            'background-color: #fff;' +
        '}' +
        '#scm-close::before { transform: rotate(45deg); }' +
        '#scm-close::after { transform: rotate(-45deg); }' +
        '#scm-body { padding: 1em; display: grid; gap: 0.7em; }' +
        '#scm-body label {' +
            'font-size: 0.8em;' +
            'letter-spacing: 0.1em;' +
            'text-transform: uppercase;' +
            'color: rgba(255,255,255,0.75);' +
        '}' +
        '#scm-code {' +
            'width: 100%; height: 2.6em;' +
            'text-align: center;' +
            'background-color: rgba(0,0,0,0.25);' +
            'color: #fff;' +
            'border: 0.15em solid rgba(255,255,255,0.3);' +
            'border-radius: 0.5em;' +
            'font-family: inherit;' +
            'font-size: 1.05em;' +
            'letter-spacing: 0.15em;' +
            'text-transform: lowercase;' +
            'text-shadow: 0 0.06em 0.2em rgba(0,0,0,0.9);' +
            'outline: none;' +
            'transition: border-color 0.1s ease, background-color 0.1s ease;' +
        '}' +
        '#scm-code::placeholder { color: rgba(160,160,160,0.7); letter-spacing: 0.05em; }' +
        '#scm-code:focus { border-color: rgba(255,255,255,0.9); background-color: rgba(0,0,0,0.35); }' +
        '#scm-hint {' +
            'font-size: 0.78em;' +
            'letter-spacing: 0.04em;' +
            'text-align: center;' +
            'color: rgba(170,170,170,0.9);' +
            'margin-top: -0.2em;' +
        '}' +
        '#scm-preview {' +
            'text-align: center;' +
            'font-size: 0.85em;' +
            'letter-spacing: 0.05em;' +
            'color: rgba(255,255,255,0.85);' +
            'min-height: 1.2em;' +
            'line-height: 1.4;' +
        '}' +
        '#scm-preview b {' +
            'font-weight: bold;' +
            'color: rgb(255, 200, 0);' +
            'text-shadow: 0em 0.1em 0em rgba(64, 0, 0);' +
            'letter-spacing: 0.0625em;' +
        '}' +
        '#scm-create {' +
            'width: 100%; height: 2.9em;' +
            'border: none;' +
            'border-radius: 0.5em;' +
            'border-bottom: 0.3em solid rgba(0,0,0,0.3);' +
            'background-color: rgb(200,30,30);' +
            'color: #fff;' +
            'font-family: inherit;' +
            'font-size: 1em;' +
            'font-weight: 600;' +
            'letter-spacing: 0.08em;' +
            'text-transform: uppercase;' +
            'text-shadow: 0 0.06em 0.1em rgba(0,0,0,0.6);' +
            'box-shadow: 0em 0.1em 0.1em 0.01em rgba(0,0,0,0.4);' +
            'cursor: pointer;' +
            'transition: background-color 0.1s ease, transform 0.05s ease;' +
        '}' +
        '#scm-create:hover { background-color: rgb(180,20,20); }' +
        '#scm-create:active { background-color: rgb(160,20,20); transform: translateY(0.06em); }' +
        '#scm-create[disabled] { opacity: 0.55; cursor: default; transform: none; }' +
        '#scm-create[disabled]:hover { background-color: rgb(200,30,30); }' +
        '#scm-status {' +
            'min-height: 1.1em;' +
            'text-align: center;' +
            'font-size: 0.85em;' +
            'letter-spacing: 0.04em;' +
            'color: rgba(255,255,255,0.8);' +
            'word-break: break-word;' +
        '}' +
        '#scm-status.scm-ok { color: rgb(50,200,50); }' +
        '#scm-status.scm-error { color: rgb(255,140,140); }' +
        '#scm-spinner {' +
            'display: flex;' +
            'justify-content: center;' +
            'align-items: center;' +
            'height: 100%;' +
            'gap: 0.35em;' +
        '}' +
        '#scm-spinner i {' +
            'width: 0.55em; height: 0.55em;' +
            'background-color: #fff;' +
            'border-radius: 40%;' +
            '-webkit-animation: scm-bouncedelay 1.4s infinite ease-in-out both;' +
            'animation: scm-bouncedelay 1.4s infinite ease-in-out both;' +
        '}' +
        '#scm-spinner i:nth-child(1) { animation-delay: -0.32s; }' +
        '#scm-spinner i:nth-child(2) { animation-delay: -0.16s; }' +
        '@-webkit-keyframes scm-bouncedelay { 0%, 80%, 100% { -webkit-transform: scale(0); } 40% { -webkit-transform: scale(1); } }' +
        '@keyframes scm-bouncedelay { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }'
    );

    var root = document.createElement('div');
    root.id = 'scm-root';
    root.innerHTML =
        '<div id="scm-fab" role="button" tabindex="0" title="Create a custom match" aria-label="Create a custom match"><div></div></div>' +
        '<div id="scm-panel" hidden>' +
            '<div id="scm-head">' +
                '<span id="scm-title">Match Maker</span>' +
                '<div id="scm-close" role="button" aria-label="Close"></div>' +
            '</div>' +
            '<div id="scm-body">' +
                '<label for="scm-code">Match Code</label>' +
                '<input id="scm-code" spellcheck="false" autocomplete="off" autocapitalize="off" maxlength="28" placeholder="enter a code">' +
                '<div id="scm-hint">"na" is prefixed automatically · max 30 chars</div>' +
                '<div id="scm-preview"></div>' +
                '<button id="scm-create" type="button">Create Match</button>' +
                '<div id="scm-status"></div>' +
            '</div>' +
        '</div>';

    document.body.appendChild(root);

    var fab = document.getElementById('scm-fab');
    var panel = document.getElementById('scm-panel');
    var codeInput = document.getElementById('scm-code');
    var preview = document.getElementById('scm-preview');
    var createBtn = document.getElementById('scm-create');
    var statusEl = document.getElementById('scm-status');
    var closeBtn = document.getElementById('scm-close');

    function typedCode() {
        return codeInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function builtCode() {
        var t = typedCode();
        if (t.slice(0, PREFIX.length) === PREFIX) t = t.slice(PREFIX.length);
        t = t.slice(0, 30 - PREFIX.length);
        return PREFIX + t;
    }

    function setStatus(msg, kind) {
        statusEl.textContent = msg;
        statusEl.className = kind ? 'scm-' + kind : '';
    }

    function setBtnLoading(loading) {
        if (loading) {
            createBtn.innerHTML = '<div id="scm-spinner"><i></i><i></i><i></i></div>';
            createBtn.disabled = true;
        } else {
            createBtn.textContent = 'Create Match';
            createBtn.disabled = false;
        }
    }

    function updatePreview() {
        var code = builtCode();
        var shown = code === PREFIX ? 'na····' : code;
        preview.innerHTML = 'suprem.io/#<b>' + shown.replace(/[<>&"']/g, function (c) {
            return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c];
        }) + '</b>';
    }

    codeInput.addEventListener('input', function () {
        var cleaned = typedCode();
        if (codeInput.value !== cleaned) codeInput.value = cleaned;
        setStatus('', '');
        updatePreview();
    });

    function positionPanel() {
        var r = fab.getBoundingClientRect();
        var pw = panel.offsetWidth;
        var ph = panel.offsetHeight;
        var x = r.left + r.width / 2 - pw / 2;
        var y = r.top - ph - 12;
        if (y < 8) y = r.bottom + 12;
        x = Math.max(8, Math.min(x, window.innerWidth - pw - 8));
        y = Math.max(8, Math.min(y, window.innerHeight - ph - 8));
        panel.style.left = x + 'px';
        panel.style.top = y + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }

    function togglePanel(forceOpen) {
        var willOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.hidden;
        if (willOpen) {
            panel.hidden = false;
            positionPanel();
            updatePreview();
            codeInput.focus();
        } else {
            panel.hidden = true;
        }
    }

    closeBtn.addEventListener('click', function () {
        togglePanel(false);
    });

    fab.addEventListener('click', function () {
        togglePanel();
    });

    fab.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePanel();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !panel.hidden) togglePanel(false);
        if (e.key === 'Enter' && !panel.hidden && e.target === codeInput) createBtn.click();
    });

    function attachFab() {
        var volume = document.getElementById(VOLUME_BUTTON_ID);
        if (volume && volume.parentNode) {
            if (fab.parentNode !== volume.parentNode) {
                volume.parentNode.insertBefore(fab, volume);
            }
            fab.classList.add('scm-docked');
        } else {
            if (fab.parentNode !== document.body) document.body.appendChild(fab);
            fab.classList.remove('scm-docked');
        }
    }

    attachFab();

    var attachScheduled = false;
    function scheduleAttach() {
        if (attachScheduled) return;
        attachScheduled = true;
        window.setTimeout(function () {
            attachScheduled = false;
            attachFab();
        }, 50);
    }

    var observer = new MutationObserver(scheduleAttach);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', scheduleAttach);

    function handleError(status, body, fallback) {
        var msg = fallback;
        try {
            var j = JSON.parse(body);
            if (j && j.error) msg = j.error;
        } catch (e) {}
        if (status === 429) msg = 'Rate limited - wait a moment and try again';
        setStatus(msg, 'error');
    }

    createBtn.addEventListener('click', function () {
        var code = builtCode();
        codeInput.value = code.slice(PREFIX.length);

        if (code === PREFIX) {
            setStatus('Enter a code after "na"', 'error');
            codeInput.focus();
            return;
        }

        if (typeof GM_xmlhttpRequest === 'undefined') {
            setStatus('GM_xmlhttpRequest unavailable - reinstall the script', 'error');
            return;
        }

        setBtnLoading(true);
        setStatus('Creating match ' + code + '…', '');

        GM_xmlhttpRequest({
            method: 'POST',
            url: API,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ code: code }),
            onload: function (res) {
                if (res.status >= 200 && res.status < 300) {
                    var ok = false;
                    try {
                        var j = JSON.parse(res.responseText);
                        ok = j && j.room;
                    } catch (e) {}
                    if (ok) {
                        codeInput.value = '';
                        setBtnLoading(false);
                        createBtn.focus();
                        setStatus('Created! Joining ' + code + '…', 'ok');
                        try {
                            navigator.clipboard.writeText('https://suprem.io/#' + code);
                        } catch (e) {}
                        window.setTimeout(function () {
                            location.href = 'https://suprem.io/#' + code;
                        }, 450);
                        return;
                    }
                    handleError(res.status, res.responseText, 'Could not create match');
                } else {
                    handleError(res.status, res.responseText, 'Request failed (HTTP ' + res.status + ')');
                }
                setBtnLoading(false);
            },
            onerror: function () {
                handleError(0, '', 'Network error - could not reach matchmaker');
                setBtnLoading(false);
            },
            ontimeout: function () {
                setStatus('Request timed out', 'error');
                setBtnLoading(false);
            }
        });
    });
})();