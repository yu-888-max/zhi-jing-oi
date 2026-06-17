// @updateURL https://raw.githubusercontent.com/yu-888-max/zhi-jing-oi/main/zhi-jing-oi.user.js
// ==UserScript==
// @name         致境·OI
// @namespace    http://yu666.luogu.goal
// @version      5.4.1
// @description  致境·OI：液态玻璃美学 + AI混合调度
// @author       yu_666
// @match        *://*.luogu.com.cn/*
// @match        *://*.luogu.com/*
// @match        *://*.codeforces.com/*
// @match        *://codeforces.com/*
// @match        *://*.atcoder.jp/*
// @match        *://atcoder.jp/*
// @match        *://*.leetcode.cn/*
// @match        *://leetcode.cn/*
// @match        *://chat.deepseek.com/*
// @match        *://gemini.google.com/*
// @match        *://uhunt.onlinejudge.org/*
// @match        *://onlinejudge.org/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      www.luogu.com.cn
// @connect      v1.hitokoto.cn
// @connect      codeforces.com
// @connect      kenkoooo.com
// @connect      leetcode.cn
// @connect      uhunt.onlinejudge.org
// @connect      text.pollinations.ai
// @connect      *
// @run-at       document-end
// @icon         https://www.luogu.com.cn/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    // ===================== 洛谷标签 → 知乎搜索 =====================
    if (location.hostname.includes('luogu.com.cn')) {
        document.addEventListener('click', function(e) {
            let target = e.target;
            while (target && target.tagName !== 'A') {
                target = target.parentElement;
                if (!target) return;
            }
            if (target.tagName === 'A' && target.href && target.href.includes('/problem/list?tag=')) {
                e.preventDefault();
                e.stopPropagation();
                const tagText = target.textContent.trim();
                if (tagText) {
                    const zhihuUrl = 'https://www.zhihu.com/search?type=content&q=' + encodeURIComponent(tagText);
                    const newWin = window.open(zhihuUrl, '_blank');
                    if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') location.href = zhihuUrl;
                }
            }
        });
    }

    // =================== AI 混合调度引擎 ===================
    const STORE_MD = 'luogu_md_v8';
    const STORE_PEND = 'luogu_pending_v8';
    const STORE_AI_TYPE = 'luogu_pending_ai_type';

    const STORE_SIMPLIFY_MODE = 'luogu_simplify_mode';
    const STORE_SIMPLIFY_AI = 'luogu_simplify_ai_type';
    const STORE_SIMPLIFY_TEXT = 'luogu_simplify_pending_text';
    const STORE_SIMPLIFY_RESULT = 'luogu_simplify_result';

    const buildTeachPrompt = (md) => `C++教我一下，请用不太现代化（避免auto、lambda等）、易懂的代码风格解答。
要求：
1. 先讲清楚题目在问什么，给出解题思路
2. 逐步推导，解释每一步为什么这样做
3. 给出完整代码，关键行加上注释
4. 最后分析时间复杂度和空间复杂度

题目如下：\n\n${md}`;

    const buildSimplifyPrompt = (md) => `你是一个无情的题意简化机器。请帮我去除题目中冗长的背景故事，用最简明扼要的语言，提炼出纯粹的【核心题意】（已知什么，求什么）以及【关键数据范围】。
⚠️警告：绝对不要提供任何解题思路、算法提示或做法分析！只做题面翻译和缩写，把思考的空间留给我自己！

题目如下：\n\n${md}`;

    let pendingAiTask = null;

    const renderMd = (text) => {
        let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(128,128,128,0.1);padding:12px;border-radius:12px;overflow-x:auto;margin:8px 0;"><code>$1</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(128,128,128,0.15);padding:2px 6px;border-radius:6px;font-family:monospace;">$1</code>');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/\n/g, '<br>');
        return html;
    };

    function showAiResultModal(action, content, model) {
        const isTeach = action === 'teach';
        const title = isTeach ? '🤖 AI 教我' : '✨ 题意简化';
        const gradient = isTeach ? 'linear-gradient(135deg, #4f46e5, #9333ea)' : 'linear-gradient(135deg, #10b981, #3b82f6)';

        let modelName = '内置免费引擎';
        if (model === 'deepseek') modelName = 'DeepSeek';
        if (model === 'gemini') modelName = 'Gemini';

        let modal = document.getElementById('hm-ai-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'hm-ai-modal';
            modal.className = 'hm-ai-modal';
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'hm-close-ai-modal') modal.classList.remove('show');
            });
        }

        modal.innerHTML = `
            <div style="font-size:22px; font-weight:800; margin-bottom:18px; color:var(--hm-text); letter-spacing:-0.5px; display:flex; align-items:center; gap:10px;">
                <span style="background:${gradient}; -webkit-background-clip:text; -webkit-text-fill-color:transparent;">${title}</span>
                <span style="font-size:12px; font-weight:400; color:var(--hm-text); opacity:0.6; background:rgba(128,128,128,0.1); padding:2px 8px; border-radius:10px;">${modelName}</span>
            </div>
            <div style="flex:1; overflow-y:auto; font-size:15px; line-height:1.7; color:var(--hm-text); padding-right:10px; scrollbar-width: thin;">${renderMd(content)}</div>
            <div style="text-align:right; margin-top:24px;">
                <button id="hm-close-ai-modal" class="hm-ai-modal-close">我知道了</button>
            </div>
        `;
        requestAnimationFrame(() => modal.classList.add('show'));
    }

    let simplifyPollTimer = null;
    function startSimplifyPoll(model) {
        if (simplifyPollTimer) clearInterval(simplifyPollTimer);
        simplifyPollTimer = setInterval(() => {
            const result = GM_getValue(STORE_SIMPLIFY_RESULT, '');
            if (result) {
                clearInterval(simplifyPollTimer);
                simplifyPollTimer = null;
                GM_deleteValue(STORE_SIMPLIFY_RESULT);
                showAiResultModal('simplify', result, model);
            }
        }, 1000);
        setTimeout(() => { if (simplifyPollTimer) { clearInterval(simplifyPollTimer); simplifyPollTimer = null; } }, 45000);
    }

    if (location.hostname === 'chat.deepseek.com') {
        if (GM_getValue(STORE_SIMPLIFY_MODE, false) && GM_getValue(STORE_SIMPLIFY_AI, '') === 'deepseek') {
            GM_deleteValue(STORE_SIMPLIFY_MODE);
            const md = GM_getValue(STORE_SIMPLIFY_TEXT, '');
            if (md) { GM_deleteValue(STORE_SIMPLIFY_TEXT); waitForEditorDS((ta) => { sendTextAndListen(ta, buildSimplifyPrompt(md), 'deepseek'); }); }
        } else if (GM_getValue(STORE_PEND, false) && GM_getValue(STORE_AI_TYPE, '') === 'deepseek') {
            GM_deleteValue(STORE_PEND); GM_deleteValue(STORE_AI_TYPE);
            const md = GM_getValue(STORE_MD, '');
            if (md) { waitForEditorDS(async (ta) => { await enableExpertMode(); sendTextAndListen(ta, buildTeachPrompt(md), 'deepseek'); }); }
        }
    }

    if (location.hostname === 'gemini.google.com') {
        if (GM_getValue(STORE_SIMPLIFY_MODE, false) && GM_getValue(STORE_SIMPLIFY_AI, '') === 'gemini') {
            GM_deleteValue(STORE_SIMPLIFY_MODE);
            const md = GM_getValue(STORE_SIMPLIFY_TEXT, '');
            if (md) { GM_deleteValue(STORE_SIMPLIFY_TEXT); waitForEditorGemini((editor) => { sendTextAndListenGemini(editor, buildSimplifyPrompt(md)); }); }
        } else if (GM_getValue(STORE_PEND, false) && GM_getValue(STORE_AI_TYPE, '') === 'gemini') {
            GM_deleteValue(STORE_PEND); GM_deleteValue(STORE_AI_TYPE);
            const md = GM_getValue(STORE_MD, '');
            if (md) { waitForEditorGemini((editor) => { sendTextAndListenGemini(editor, buildTeachPrompt(md)); }); }
        }
    }

    function waitForEditorDS(cb) {
        const ta = document.querySelector('#chat-input, textarea[placeholder*="DeepSeek"], textarea');
        if (ta) return cb(ta); setTimeout(() => waitForEditorDS(cb), 400);
    }
    function waitForEditorGemini(cb) {
        const editor = document.querySelector('rich-textarea div[contenteditable="true"]') || document.querySelector('.ql-editor') || document.querySelector('div[contenteditable="true"][role="textbox"]');
        if (editor) return cb(editor); setTimeout(() => waitForEditorGemini(cb), 500);
    }
    async function enableExpertMode(retries = 5) {
        for (let i = 0; i < retries; i++) {
            try { const radio = document.querySelector('[data-model-type="expert"], [data-model-type="deepthink"]'); if (radio && radio.getAttribute('aria-checked') !== 'true') { radio.click(); return; } } catch(e) {}
            await new Promise(r => setTimeout(r, 500));
        }
    }
    function sendTextAndListen(textarea, text, type) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(textarea, text); textarea.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => { textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })); startDeepSeekReplyListener(); }, 300);
    }
    function sendTextAndListenGemini(editor, text) {
        editor.focus(); document.execCommand('insertText', false, text);
        setTimeout(() => { const sendBtn = document.querySelector('button[aria-label*="Send"], button[aria-label*="发送"], .send-button'); if (sendBtn && !sendBtn.disabled) sendBtn.click(); startGeminiReplyListener(); }, 800);
    }
    function startDeepSeekReplyListener() {
        const observer = new MutationObserver((mutations, obs) => {
            const messages = document.querySelectorAll('[class*="message"]'); const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.querySelector('[class*="markdown"]')) {
                setTimeout(() => { const content = lastMsg.querySelector('[class*="markdown"]').innerText; if (content) { GM_setValue(STORE_SIMPLIFY_RESULT, content); obs.disconnect(); } }, 2000);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true }); setTimeout(() => observer.disconnect(), 35000);
    }
    function startGeminiReplyListener() {
        const observer = new MutationObserver((mutations, obs) => {
            const responseBlocks = document.querySelectorAll('.model-response, .message-content'); const lastBlock = responseBlocks[responseBlocks.length - 1];
            if (lastBlock && lastBlock.innerText.trim().length > 20) {
                setTimeout(() => { const content = lastBlock.innerText; if (content) { GM_setValue(STORE_SIMPLIFY_RESULT, content); obs.disconnect(); } }, 2000);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true }); setTimeout(() => observer.disconnect(), 35000);
    }

    async function executeAiTask(action, engine, md, btnElement) {
        const origText = btnElement.innerHTML;
        btnElement.innerHTML = '⏳ 联络中...';
        btnElement.style.pointerEvents = 'none';

        if (engine === 'builtin') {
            const prompt = action === 'teach' ? buildTeachPrompt(md) : buildSimplifyPrompt(md);
            try {
                const res = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'POST', url: 'https://text.pollinations.ai/openai',
                        headers: { 'Content-Type': 'application/json' }, timeout: 45000,
                        data: JSON.stringify({
                            model: 'openai', stream: false,
                            messages: [ {role: 'system', content: '你是一个严格服从指令的助手。请用通俗易懂、结构清晰的中文进行回答。'}, {role: 'user', content: prompt} ]
                        }),
                        onload: res => {
                            try {
                                if (res.status !== 200) return reject(new Error('免费接口暂时不可用，状态码：' + res.status));
                                let text = res.responseText;
                                try { const data = JSON.parse(text); if (data.choices && data.choices.length > 0) return resolve(data.choices[0].message.content); } catch(e) {}
                                if (text && text.trim().length > 0) resolve(text); else reject(new Error('免费节点返回内容为空'));
                            } catch (e) { reject(new Error('免费节点响应异常')); }
                        },
                        onerror: () => reject(new Error('网络请求失败，请检查环境')),
                        ontimeout: () => reject(new Error('请求超时 (45秒)，请重试'))
                    });
                });
                showAiResultModal(action, res, 'builtin');
            } catch (err) { alert('AI 辅助暂时出错：' + err.message); }
            finally { btnElement.innerHTML = origText; btnElement.style.pointerEvents = 'auto'; }
        } else {
            if (action === 'teach') { GM_setValue(STORE_MD, md); GM_setValue(STORE_PEND, true); GM_setValue(STORE_AI_TYPE, engine); }
            else { GM_setValue(STORE_SIMPLIFY_TEXT, md); GM_setValue(STORE_SIMPLIFY_MODE, true); GM_setValue(STORE_SIMPLIFY_AI, engine); startSimplifyPoll(engine); }
            btnElement.innerHTML = origText; btnElement.style.pointerEvents = 'auto';
            window.open(engine === 'deepseek' ? 'https://chat.deepseek.com/' : 'https://gemini.google.com/app', '_blank');
        }
    }

    function addAIBotButton(selector, extractFn) {
        function tryAdd() {
            const container = typeof selector === 'string' ? document.querySelector(selector) : selector();
            if (!container) { setTimeout(tryAdd, 500); return; }
            if (document.getElementById('ai-help-btn')) return;

            const btn = document.createElement('a'); btn.id = 'ai-help-btn'; btn.href = 'javascript:void 0';
            btn.style.cssText = 'margin-left:12px;color:#4f46e5;font-weight:bold;cursor:pointer;text-decoration:none;';
            btn.innerHTML = '🤖 AI 教我';
            btn.onclick = async () => {
                const prefs = loadUIPrefs(); const engine = prefs.aiTeachEngine || 'builtin';
                const text = await Promise.resolve(extractFn());
                if (!text || text.length < 10) return alert('提取失败，请重试');
                if (engine === 'ask') { pendingAiTask = { action: 'teach', text, btnElement: btn }; transitionTo('ai'); }
                else { executeAiTask('teach', engine, text, btn); }
            };
            container.appendChild(btn);

            const simBtn = document.createElement('a'); simBtn.id = 'ai-simplify-btn'; simBtn.href = 'javascript:void 0';
            simBtn.style.cssText = 'margin-left:12px;color:#10b981;font-weight:bold;cursor:pointer;text-decoration:none;';
            simBtn.innerHTML = '✨ 简化题意';
            simBtn.onclick = async () => {
                const prefs = loadUIPrefs(); const engine = prefs.aiSimplifyEngine || 'builtin';
                const text = await Promise.resolve(extractFn());
                if (!text || text.length < 10) return alert('提取失败，请重试');
                if (engine === 'ask') { pendingAiTask = { action: 'simplify', text, btnElement: simBtn }; transitionTo('ai'); }
                else { executeAiTask('simplify', engine, text, simBtn); }
            };
            container.appendChild(simBtn);
        }
        tryAdd();
    }

    if (location.hostname === 'www.luogu.com.cn' && location.pathname.startsWith('/problem/')) {
        addAIBotButton('.problem-block-actions, .operation', () => {
            return new Promise(resolve => {
                const origWrite = navigator.clipboard.writeText; let captured = '';
                let timeout = setTimeout(() => { navigator.clipboard.writeText = origWrite; resolve(document.querySelector('.problem-card')?.innerText || window.location.href); }, 800);
                navigator.clipboard.writeText = (text) => { captured = text; navigator.clipboard.writeText = origWrite; clearTimeout(timeout); resolve(captured); return Promise.resolve(); };
                const copyLink = document.querySelector('a[href="javascript:void 0"]');
                if (!copyLink) { navigator.clipboard.writeText = origWrite; clearTimeout(timeout); resolve(''); return; }
                copyLink.click();
            });
        });
    }
    if (location.hostname.includes('codeforces.com') && location.pathname.includes('/problem')) addAIBotButton('.problem-statement .header .title', () => document.querySelector('.problem-statement')?.innerText || '');
    if (location.hostname.includes('atcoder.jp') && location.pathname.includes('/tasks/')) addAIBotButton('span.h2, .h2', () => document.querySelector('#task-statement')?.innerText || '');
    if (location.hostname.includes('leetcode.cn') && location.pathname.includes('/problems/')) {
        addAIBotButton('.text-title-large, h1', () => { const title = document.querySelector('.text-title-large, h1')?.innerText || ''; const desc = document.querySelector('[data-track-load="description_content"]') || document.querySelector('div[class*="content"]'); return title + '\n\n' + (desc?.innerText || window.location.href); });
    }

    // =================== 致境·OI 主体 ===================
    const SYNC_FREEZE_LIMIT = 3 * 60 * 1000;
    const dbKey = 'zhi_jing_oi_data';
    const UI_PREFS_KEY = 'hm_ui_prefs';
    const PANEL_W = 740;

    const DEFAULT_UI_PREFS = {
        physicsEnabled: true, liquidGlass: true, constrainToScreen: true,
        icon: '🎯', hitokotoMode: 'both', hitokotoApi: 'https://v1.hitokoto.cn/?c=d&c=i&c=k',
        glassOpacity: 0.35, accentColor: '#007DFF', darkMode: 'auto',
        fontFamily: '', backgroundImageUrl: '', edgeHideEnabled: true,
        goalMode: 'count', weeklyGoalCount: 10, weeklyGoalScore: 50,
        lg_w: [1,1,2,3,4,5,6,8], cf_w: 400, at_w: 100, uva_w: 1, lc_w: 1,
        lgMinDiff: 0, cfMinRating: 0, atMinPoint: 0,
        reportAutoShow: false, autoSyncEnabled: false, syncCooldown: 3,
        goalNotify: false, ballSize: 68, defaultView: 'main', ballDoubleClick: 'none',
        aiTeachEngine: 'builtin', aiSimplifyEngine: 'builtin'
    };

    function loadUIPrefs() { return { ...DEFAULT_UI_PREFS, ...GM_getValue(UI_PREFS_KEY, {}) }; }
    function getConfig() {
        const def = { name: 'OIer', d: 1, h: 0, m: 0, lg: '', cf: '', at: '', lc: '', uva: '', w_en: false, lg_w: [1,1,2,3,4,5,6,8], cf_w: 400, at_w: 100, uva_w: 1, lc_w: 1, weeklyGoal: 10, weeklyGoalCount: 10, weeklyGoalScore: 50, goalMode: 'count' };
        return Object.assign(def, GM_getValue('yu_config', {}));
    }

    let currentUIPrefs = loadUIPrefs();

    function migrateData() {
        let d = GM_getValue(dbKey); if (!d) return;
        const migrateArr = (arr, mapper) => { if (arr && arr.length > 0 && typeof arr[0] === 'string') return arr.map(mapper); return arr || []; };
        d.weeklySolvedPids = migrateArr(d.weeklySolvedPids, id => ({id, diff:0}));
        d.cfWeeklySolvedPids = migrateArr(d.cfWeeklySolvedPids, id => ({id, rating:800}));
        d.atWeeklySolvedPids = migrateArr(d.atWeeklySolvedPids, id => ({id, point:100}));
        d.lcWeeklySolvedPids = d.lcWeeklySolvedPids || [];
        d.uvaWeeklySolvedPids = migrateArr(d.uvaWeeklySolvedPids, id => ({id, diff:0}));
        d.dailyRecords = d.dailyRecords || {}; d.weeklyHistory = d.weeklyHistory || [];
        if (!d.weeklyGoalCount && d.weeklyGoal) d.weeklyGoalCount = d.weeklyGoal;
        if (!d.weeklyGoalScore) d.weeklyGoalScore = 50;
        GM_setValue(dbKey, d);
    }
    migrateData();

    function evaluateStats(d, prefs) {
        let count = 0, score = 0;
        const lArr = d.weeklySolvedPids || [], cArr = d.cfWeeklySolvedPids || [], aArr = d.atWeeklySolvedPids || [], lcArr = d.lcWeeklySolvedPids || [], uArr = d.uvaWeeklySolvedPids || [];
        count = lArr.length + cArr.length + aArr.length + lcArr.length + uArr.length;
        const lg_w = prefs.lg_w || DEFAULT_UI_PREFS.lg_w, cf_w = prefs.cf_w || DEFAULT_UI_PREFS.cf_w, at_w = prefs.at_w || DEFAULT_UI_PREFS.at_w;
        const lgMin = prefs.lgMinDiff || 0, cfMin = prefs.cfMinRating || 0, atMin = prefs.atMinPoint || 0;
        lArr.forEach(p => { let diff = parseInt(p.diff) || 0; if (diff >= lgMin) score += parseFloat(lg_w[Math.min(lg_w.length - 1, Math.max(0, diff))] || 1); });
        cArr.forEach(p => { let r = parseFloat(p.rating) || 0; if (r >= cfMin) score += r > 0 ? (r / cf_w) : 1; });
        aArr.forEach(p => { let pt = parseFloat(p.point) || 0; if (pt >= atMin) score += pt > 0 ? (pt / at_w) : 1; });
        lcArr.forEach(() => score += prefs.lc_w || 1); uArr.forEach(() => score += prefs.uva_w || 1);
        return { count, score: score || 0 };
    }

    function archiveWeeklyData() {
        const d = GM_getValue(dbKey); if (!d) return;
        const stats = evaluateStats(d, currentUIPrefs);
        const history = d.weeklyHistory || [];
        history.push({ weekStart: new Date(getBoundaries().last).toISOString().slice(0,10), count: stats.count, score: stats.score });
        if (history.length > 12) history.shift();
        d.weeklyHistory = history; GM_setValue(dbKey, d);
    }

    function autoDetectAndSave() {
        let config = getConfig(), updated = false, host = window.location.hostname;
        if (host.includes('luogu.com')) {
            const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            let uid = w._feInjection?.currentUser?.uid || w._headerData?.currentUser?.uid || w._LuoguConfig?.uid;
            if (!uid) { const m = document.cookie.match(/(?:^|;)\s*_uid=(\d+)/); uid = m ? m[1] : null; }
            if (uid && config.lg !== String(uid)) { config.lg = String(uid); updated = true; }
        }
        if (updated) GM_setValue('yu_config', config); return config;
    }

    const safeWait = (ms) => new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
    async function fetchOS(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({ method: "GET", url, headers: { "x-lentille-request": "content-only" },
                onload: res => {
                    const t = res.responseText;
                    if (t.includes('decodeURIComponent')) { const m = t.match(/decodeURIComponent\("([^"]+)"\)/); if (m) return resolve(JSON.parse(decodeURIComponent(m[1]))); }
                    try { resolve(JSON.parse(t)); } catch (e) { resolve(null); }
                }, onerror: () => resolve(null) });
        });
    }

    function getBoundaries() {
        const c = getConfig(); let now = new Date(), start = new Date(now);
        let dayDiff = (now.getDay() - c.d + 7) % 7;
        if (dayDiff === 0 && (now.getHours() * 60 + now.getMinutes() < c.h * 60 + c.m)) dayDiff = 7;
        start.setDate(now.getDate() - dayDiff); start.setHours(c.h, c.m, 0, 0);
        const next = new Date(start); next.setDate(next.getDate() + 7);
        return { last: start.getTime(), next: next.getTime() };
    }

    async function startIncrementalTrace(dbKey, silent = false) {
        const bound = getBoundaries(), userData = GM_getValue(dbKey) || { weeklyGoalCount: 10, weeklyGoalScore: 50 };
        if (!silent) {
            const lastManual = GM_getValue('last_manual_sync_ts', 0);
            if (Date.now() - lastManual < SYNC_FREEZE_LIMIT) return;
            GM_setValue('last_manual_sync_ts', Date.now());
        }
        const stopBoundary = Math.max(bound.last, userData.lastSync || 0);
        let weeklyPidsMap = new Map((userData.weeklySolvedPids || []).map(p => [p.id, p]));
        let contestOnlyPids = new Set(userData.contestOnlyPids || []);
        let cfPidsMap = new Map((userData.cfWeeklySolvedPids || []).map(p => [p.id, p]));
        let atPidsMap = new Map((userData.atWeeklySolvedPids || []).map(p => [p.id, p]));

        const logCompact = (msg, sub) => {
            if (!silent && currentState === 'main') {
                const vMain = document.querySelector('#hm-view-main .hm-view-content');
                if (vMain) vMain.innerHTML = `<div class="hm-text-premium hm-view-title" style="text-align:center;margin-bottom:20px;">🌟 深度溯源中...</div><div class="sync-log">${msg}<br><span style="opacity:0.6;">${sub}</span></div><div style="height:4px;background:rgba(0,0,0,0.05);border-radius:10px;overflow:hidden;"><div style="width:40%;height:100%;background:var(--hm-blue);border-radius:10px;animation:hm-scan 1.5s infinite linear;"></div></div>`;
            }
        };

        const config = getConfig();
        try {
            if (config.lg) {
                let page = 1, foundPotential = new Map(), stop = false;
                while (!stop && page <= 3) {
                    logCompact('检索洛谷记录', `第 ${page} 页`); await safeWait(1500);
                    const data = await fetchOS(`https://www.luogu.com.cn/record/list?user=${config.lg}&status=12&page=${page}`);
                    const rs = data?.currentData?.records?.result || data?.records?.result || [];
                    if (!rs.length) break;
                    for (let r of rs) { if (r.submitTime * 1000 <= stopBoundary) { stop = true; break; } if (r.problem?.pid) foundPotential.set(r.problem.pid, r.problem.difficulty || 0); }
                    if (!stop) page++;
                }
                let pids = Array.from(foundPotential.keys());
                for (let i = 0; i < pids.length; i++) {
                    const pid = pids[i]; if (weeklyPidsMap.has(pid)) continue;
                    logCompact('校验题目库', `${i+1}/${pids.length} - [${pid}]`); await safeWait(2000);
                    const d = await fetchOS(`https://www.luogu.com.cn/record/list?user=${config.lg}&pid=${pid}&status=12&page=1`);
                    const allRs = d?.currentData?.records?.result || d?.records?.result || [];
                    const prac = allRs.filter(r => !r.contest && (r.submitTime * 1000 >= bound.last));
                    const cont = allRs.filter(r => r.contest && (r.submitTime * 1000 >= bound.last));
                    if (prac.length > 0) { weeklyPidsMap.set(pid, { id: pid, diff: foundPotential.get(pid) }); }
                    else if (cont.length > 0 && !weeklyPidsMap.has(pid)) contestOnlyPids.add(pid);
                }
            }
            if (config.cf) {
                logCompact('同步 Codeforces', config.cf); await safeWait(3000);
                const cfRes = await new Promise(res => GM_xmlhttpRequest({ method: "GET", url: `https://codeforces.com/api/user.status?handle=${config.cf}&from=1&count=60`, onload: r => res(JSON.parse(r.responseText)), onerror: () => res(null) }));
                if (cfRes?.status === "OK") for (let s of cfRes.result) { if (s.creationTimeSeconds * 1000 < bound.last) break; if (s.verdict === "OK") cfPidsMap.set(`${s.problem.contestId}${s.problem.index}`, { id: `${s.problem.contestId}${s.problem.index}`, rating: s.problem.rating || 0 }); }
            }
            userData.weeklySolvedPids = Array.from(weeklyPidsMap.values());
            userData.cfWeeklySolvedPids = Array.from(cfPidsMap.values());
            userData.atWeeklySolvedPids = Array.from(atPidsMap.values());
            userData.contestOnlyPids = [...contestOnlyPids];
            userData.lastSync = Date.now(); userData.nextResetTime = bound.next;

            const today = new Date().toISOString().slice(0,10);
            if (!userData.dailyRecords) userData.dailyRecords = {};
            const todayCount = userData.weeklySolvedPids.length+userData.cfWeeklySolvedPids.length+userData.atWeeklySolvedPids.length+(userData.lcWeeklySolvedPids||[]).length+(userData.uvaWeeklySolvedPids||[]).length;
            if (todayCount > 0) userData.dailyRecords[today] = todayCount;

            GM_setValue(dbKey, userData);
            if (currentState === 'main') renderMainView(dbKey);
        } catch (e) { console.error(e); }
    }

    // ===================== UI 样式 (精准GPU层 + 丝滑动画) =====================
    const styleEl = document.createElement('style');
    function updateDynamicStyles() {
        const p = currentUIPrefs;
        const dark = p.darkMode === 'dark' || (p.darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        styleEl.innerHTML = `
        :root { --hm-blue: ${p.accentColor}; --hm-glass-alpha: ${p.glassOpacity}; --hm-bg: ${dark?'#1c1c1e':'#ffffff'}; --hm-glass-bg: ${dark?'rgba(28,28,30,0.5)':'rgba(255,255,255,0.45)'}; --hm-text: ${dark?'#f5f5f7':'#1d1d1f'}; --hm-text-secondary: ${dark?'rgba(255,255,255,0.7)':'rgba(0,0,0,0.6)'}; --hm-border: ${dark?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.75)'}; --hm-font: ${p.fontFamily||'"HarmonyOS Sans","SF Pro Display",system-ui'}; }
        #hm-widget, #hm-widget * { box-sizing:border-box!important; user-select:none!important; font-family:var(--hm-font),sans-serif; }

        #hm-widget {
            position:fixed; z-index:9999999; background:var(--hm-bg); color:var(--hm-text); transform-origin: center;
            transform: translateZ(0);
            transition: width 0.65s cubic-bezier(0.25, 1, 0.3, 1), height 0.65s cubic-bezier(0.25, 1, 0.3, 1), left 0.65s cubic-bezier(0.25, 1, 0.3, 1), top 0.65s cubic-bezier(0.25, 1, 0.3, 1), border-radius 0.65s cubic-bezier(0.25, 1, 0.3, 1);
        }
        #hm-widget.hm-glass {
            background:linear-gradient(135deg, var(--hm-glass-bg) 0%, rgba(230,240,250,0.2) 100%);
            backdrop-filter:blur(24px) saturate(180%); -webkit-backdrop-filter:blur(24px) saturate(180%);
            border:1px solid var(--hm-border);
            box-shadow:inset 0 1px 1px rgba(255,255,255,0.5), 0 20px 50px rgba(0,0,0,${dark?0.4:0.12});
        }

        .is-ball { border-radius:50%!important; cursor:pointer!important; }
        .is-panel { border-radius:32px!important; overflow:hidden; }

        .hm-view { position:absolute; inset:0; opacity:0; pointer-events:none; visibility:hidden; transition:opacity 0.3s; display:flex; flex-direction:column; }
        .hm-view.active { opacity:1; pointer-events:auto; visibility:visible; }

        #hm-view-ball { align-items:center; justify-content:center; color:var(--hm-blue); font-size:${p.ballSize*0.5}px; }
        #hm-view-main,#hm-view-data,#hm-view-report,#hm-view-ai,#hm-view-settings { padding:14px 24px 24px; max-height:85vh; }

        .hm-view-content { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; padding-right:8px; margin-right:-8px; padding-top:4px; }
        .hm-view-content::-webkit-scrollbar { width:6px; }
        .hm-view-content::-webkit-scrollbar-thumb { background:rgba(128,128,128,0.3); border-radius:10px; }

        .hm-text-premium { font-weight:800; letter-spacing:-0.5px; text-shadow:0 2px 4px rgba(255,255,255,0.5); font-size: 24px; }
        .hm-view-title { margin-bottom: 16px; text-align: center; }
        .hm-label { display:block; text-align:left; font-size:16px; margin:0 0 6px 4px; font-weight:700; color:var(--hm-text-secondary); }
        .hm-hint { font-size:13px; color:var(--hm-text-secondary); opacity:0.7; margin: 0 0 12px 4px; display:block; }

        .hm-drag-zone { cursor:grab; margin:0 0 10px; padding:8px 0; border-radius:12px; transition:background 0.2s; width: 100%; display: flex; justify-content: center; }
        .hm-drag-handle { width:48px; height:5px; background:rgba(128,128,128,0.3); border-radius:5px; transition:all 0.3s; }
        .hm-drag-zone:hover .hm-drag-handle { background:rgba(128,128,128,0.6); transform: scaleX(1.1); }

        .hm-input,.hm-glass-btn { width:100%; padding:12px 20px; line-height:1.5; border-radius:18px; background:rgba(255,255,255,var(--hm-glass-alpha)); border:1px solid var(--hm-border); box-shadow:inset 0 4px 8px rgba(255,255,255,0.6),0 6px 16px rgba(0,0,0,0.06); outline:none; font-size:17px; color:var(--hm-text); font-weight:600; transition:all 0.3s; }
        .hm-input:focus { border-color:var(--hm-blue); background:rgba(255,255,255,0.85); }
        .hm-glass-btn:hover:not(:disabled) { background:rgba(255,255,255,calc(var(--hm-glass-alpha) + 0.15)); transform:translateY(-1.5px); box-shadow:0 10px 24px rgba(0,0,0,0.1); }
        .hm-glass-btn-primary { background:linear-gradient(135deg, ${p.accentColor}77, ${p.accentColor}AA); border:1px solid rgba(255,255,255,0.4); color:white; font-weight:700; box-shadow:0 6px 20px ${p.accentColor}33; }
        .hm-glass-btn-primary:hover:not(:disabled) { background:linear-gradient(135deg, ${p.accentColor}99, ${p.accentColor}CC); }
        .hm-glass-btn:disabled { opacity:0.5; cursor:wait; transform:none; }

        .hm-progress { width:100%; height:16px; background:rgba(255,255,255,0.3); border-radius:16px; overflow:hidden; margin:12px 0 16px; box-shadow:inset 0 2px 4px rgba(0,0,0,0.05); }
        .hm-bar { height:100%; background:linear-gradient(90deg,#1d1d1f,#4a4a4d); transition:width 1s cubic-bezier(0.2,0.8,0.2,1); }

        .hm-switch { position:relative; display:inline-block; width:50px; height:28px; } .hm-switch input { opacity:0; width:0; height:0; }
        .hm-slider-toggle { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:rgba(128,128,128,0.25); transition:.3s; border-radius:30px; }
        .hm-slider-toggle:before { position:absolute; content:""; height:22px; width:22px; left:3px; bottom:3px; background:white; transition:.3s; border-radius:50%; box-shadow:0 2px 5px rgba(0,0,0,0.2); }
        input:checked + .hm-slider-toggle { background:var(--hm-blue); } input:checked + .hm-slider-toggle:before { transform:translateX(22px); }

        .hm-segment { display:flex; gap:6px; width:100%; background:rgba(255,255,255,0.25); backdrop-filter:blur(16px); padding:4px; border-radius:20px; margin-bottom:16px; box-shadow:inset 0 1px 4px rgba(0,0,0,0.05); }
        .hm-segment-btn { flex:1; padding:10px 6px; border-radius:16px; font-weight:600; font-size:15px; color:var(--hm-text); background:transparent; border:none; cursor:pointer; transition:all 0.3s; text-align:center; }
        .hm-segment-btn.active { background:rgba(255,255,255,0.4); backdrop-filter:blur(24px) saturate(200%); -webkit-backdrop-filter:blur(24px) saturate(200%); box-shadow:0 4px 14px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.6); color:var(--hm-blue); font-weight:800; }

        .hm-ac-detail { margin-top:12px; }
        .hm-ac-card { display:flex; align-items:center; padding:8px 14px; margin-bottom:6px; background:rgba(255,255,255,0.2); border-radius:14px; gap:12px; font-size:15px; border:1px solid rgba(255,255,255,0.2); transition:transform 0.2s; }
        .hm-ac-card:hover { transform: translateY(-2px); background:rgba(255,255,255,0.35); }
        .hm-ac-card a { color:var(--hm-blue); text-decoration:none; font-weight:700; margin-left:auto; }

        .hm-setting-item { margin-bottom: 24px; }
        .hm-settings-group { background: rgba(255,255,255,0.1); border-radius: 24px; padding: 24px 28px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.2); }
        .hm-weight-row { display: flex; align-items: center; gap: 16px; margin: 12px 0; }
        .hm-weight-row span { flex: 0 0 160px; font-size: 16px; font-weight: 600; text-align: right; }
        .hm-weight-row input { flex: 1; margin-bottom: 0; }
        .hm-switch-row { display: flex; justify-content: space-between; align-items: center; margin: 16px 0; font-size: 17px; font-weight: 600; }

        .hm-ai-modal {
            position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) scale(0.9) translateZ(0);
            width:600px; max-width:90vw; max-height:80vh; z-index:99999999;
            padding:28px; border-radius:28px; display:flex; flex-direction:column;
            opacity:0; visibility:hidden; transition:all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
            background: linear-gradient(135deg, var(--hm-glass-bg) 0%, rgba(128,128,128,0.1) 100%);
            backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%);
            border: 1px solid var(--hm-border); font-family: var(--hm-font),sans-serif;
            box-shadow: 0 25px 50px rgba(0,0,0,0.2), inset 0 0 15px rgba(255,255,255,0.1); color: var(--hm-text);
        }
        .hm-ai-modal.show { opacity: 1; visibility: visible; transform:translate(-50%,-50%) scale(1) translateZ(0); }
        .hm-ai-modal-close {
            background: rgba(128, 128, 128, 0.15); color: var(--hm-text); border: 1px solid var(--hm-border);
            padding: 10px 24px; border-radius: 16px; font-weight: 700; cursor: pointer; transition: all 0.3s;
        }
        .hm-ai-modal-close:hover { background: rgba(128, 128, 128, 0.25); transform: translateY(-1px); }
        `;
    }
    document.head.appendChild(styleEl);
    function refreshDynamicStyles() { updateDynamicStyles(); }

    function updateBallIcon(icon) {
        const ball = document.getElementById('hm-view-ball'); if (!ball) return;
        const str = (icon || '').trim();
        const isImg = /^(https?:\/\/|data:image\/|\.\/|\/)/i.test(str) || /\.(png|jpe?g|gif|svg|webp|ico)(\?.*)?$/i.test(str);
        if (isImg) {
            let src = str;
            if (!/^https?:\/\//i.test(src) && !src.startsWith('data:') && !src.startsWith('/') && !src.startsWith('./')) src = 'https://' + src;
            ball.innerHTML = `<img src="${src}" alt="icon" style="width:40px;height:40px;object-fit:contain;border-radius:50%;">`;
        } else { ball.textContent = str || '🎯'; }
    }

    let currentState = 'ball';
    const hmOverlay = document.createElement('div');
    hmOverlay.id = 'hm-widget-overlay';
    hmOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:9999998;backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity 0.4s;transform:translateZ(0);';
    document.body.appendChild(hmOverlay);

    // 严密阻断点击穿透
    ['mousedown', 'touchstart', 'click'].forEach(evt => {
        hmOverlay.addEventListener(evt, (e) => {
            if (e.target === hmOverlay) {
                e.preventDefault(); e.stopPropagation();
                if ((evt === 'mousedown' || evt === 'touchstart') && currentState !== 'ball') {
                    transitionTo('ball');
                }
            }
        }, { passive: false });
    });

    const widget = document.createElement('div'); widget.id = 'hm-widget'; widget.className = 'hm-glass is-ball';
    const ballSize = currentUIPrefs.ballSize || 68;
    widget.style.cssText = `width:${ballSize}px;height:${ballSize}px;left:${window.innerWidth-ballSize-20}px;top:${window.innerHeight-ballSize-20}px;opacity:0;pointer-events:none;`;

    const views = ['ball', 'main', 'settings', 'data', 'report', 'ai'];
    views.forEach(v => {
        const el = document.createElement('div'); el.id = 'hm-view-' + v; el.className = 'hm-view' + (v==='ball'?' active':'');
        if(v !== 'ball') el.innerHTML = `<div class="hm-drag-zone" title="拖动"><div class="hm-drag-handle"></div></div><div class="hm-view-content"></div>`;
        widget.appendChild(el);
    });
    document.body.appendChild(widget);
    widget.classList.toggle('hm-glass', currentUIPrefs.liquidGlass);
    updateBallIcon(currentUIPrefs.icon);
    refreshDynamicStyles();

    function smartUpdateWidgetPos(targetH, targetW = PANEL_W) {
        const rect = widget.getBoundingClientRect();
        const curCX = rect.left + rect.width / 2;
        const curCY = rect.top + rect.height / 2;
        let nextL = curCX - targetW / 2;
        let nextT = curCY - targetH / 2;
        nextL = Math.max(20, Math.min(window.innerWidth - targetW - 20, nextL));
        nextT = Math.max(20, Math.min(window.innerHeight - targetH - 20, nextT));
        widget.style.width = targetW + 'px';
        widget.style.height = targetH + 'px';
        widget.style.left = nextL + 'px';
        widget.style.top = nextT + 'px';
    }

    function adjustMainWidgetSize() {
        if (currentState === 'ball') return;
        requestAnimationFrame(() => {
            const v = document.getElementById('hm-view-' + currentState);
            if (!v) return;
            const contentEl = v.querySelector('.hm-view-content');
            if (contentEl) {
                const h = Math.min(contentEl.scrollHeight + 50, window.innerHeight * 0.85);
                smartUpdateWidgetPos(h, PANEL_W);
            }
        });
    }

    let edgeTimer = null, widgetVisible = true, edgeOriginalLeft = null;
    function resetEdgeTimer() {
        if (!currentUIPrefs.edgeHideEnabled || currentState !== 'ball') {
            if (edgeTimer) clearTimeout(edgeTimer);
            widget.style.opacity='1'; widgetVisible=true;
            return;
        }
        if (edgeTimer) clearTimeout(edgeTimer);
        widget.style.opacity='1'; widgetVisible=true;
        edgeTimer = setTimeout(() => {
            if (currentState === 'ball' && !isDragging) {
                widget.style.opacity='0.3'; widgetVisible=false;
                const rect = widget.getBoundingClientRect();
                edgeOriginalLeft = rect.left;
                widget.style.left = rect.left + rect.width/2 < window.innerWidth/2 ? `-${rect.width*0.4}px` : `${window.innerWidth-rect.width*0.6}px`;
            }
        }, 3000);
    }
    widget.addEventListener('mouseenter', () => {
        if (currentUIPrefs.edgeHideEnabled && !widgetVisible && edgeOriginalLeft !== null) {
            widget.style.left = edgeOriginalLeft+'px';
            widget.style.opacity='1'; widgetVisible=true;
        }
        resetEdgeTimer();
    });
    widget.addEventListener('mouseleave', resetEdgeTimer);

    function transitionTo(viewName) {
        if (viewName === 'main') renderMainView(dbKey);
        if (viewName === 'settings') renderSettingsView(dbKey);
        if (viewName === 'data') renderDataView(dbKey);
        if (viewName === 'report') renderReportView();
        if (viewName === 'ai') renderAIView();

        requestAnimationFrame(() => {
            let tW = currentUIPrefs.ballSize||68, tH = currentUIPrefs.ballSize||68;
            if (viewName !== 'ball') {
                tW = PANEL_W;
                const v = document.getElementById('hm-view-' + viewName);
                const contentEl = v.querySelector('.hm-view-content');
                if (contentEl) {
                    v.style.display = 'flex';
                    tH = Math.min(contentEl.scrollHeight + 50, window.innerHeight * 0.85);
                    v.style.display = '';
                } else tH = 500;
            }
            smartUpdateWidgetPos(tH, tW);
            widget.classList.toggle('is-ball', viewName==='ball');
            widget.classList.toggle('is-panel', viewName!=='ball');
            document.querySelectorAll('.hm-view').forEach(v => v.classList.remove('active'));
            document.getElementById('hm-view-'+viewName).classList.add('active');
            currentState = viewName;

            hmOverlay.style.opacity = viewName!=='ball' ? '1' : '0';
            hmOverlay.style.pointerEvents = viewName!=='ball' ? 'auto' : 'none';

            resetEdgeTimer();
            if (viewName === 'ball') updateBallIcon(currentUIPrefs.icon);
        });
    }

    function getVContent(id) { return document.querySelector(`#hm-view-${id} .hm-view-content`); }

    function renderAIView() {
        const v = getVContent('ai'); if (!v || v.innerHTML) return;
        v.innerHTML = `
            <div style="text-align:center">
                <div style="font-size:48px;margin:10px 0">🤖</div>
                <h3 class="hm-text-premium hm-view-title">选择本次使用的 AI</h3>
                <div style="display:flex;gap:12px">
                    <button id="hm-btn-ai-builtin" class="hm-glass-btn hm-glass-btn-primary" style="flex:1">内置免费接口</button>
                    <button id="hm-btn-ai-ds" class="hm-glass-btn" style="flex:1">DeepSeek</button>
                    <button id="hm-btn-ai-gemini" class="hm-glass-btn" style="flex:1">Gemini</button>
                </div>
                <button id="hm-btn-ai-cancel" class="hm-glass-btn" style="margin-top:16px">❌ 取消</button>
            </div>
        `;
        document.getElementById('hm-btn-ai-builtin').onclick = () => {
            if (pendingAiTask) { transitionTo('ball'); executeAiTask(pendingAiTask.action, 'builtin', pendingAiTask.text, pendingAiTask.btnElement); pendingAiTask = null; }
        };
        document.getElementById('hm-btn-ai-ds').onclick = () => {
            if (pendingAiTask) { transitionTo('ball'); executeAiTask(pendingAiTask.action, 'deepseek', pendingAiTask.text, pendingAiTask.btnElement); pendingAiTask = null; }
        };
        document.getElementById('hm-btn-ai-gemini').onclick = () => {
            if (pendingAiTask) { transitionTo('ball'); executeAiTask(pendingAiTask.action, 'gemini', pendingAiTask.text, pendingAiTask.btnElement); pendingAiTask = null; }
        };
        document.getElementById('hm-btn-ai-cancel').onclick = () => { pendingAiTask = null; transitionTo('ball'); };
    }

    function renderMainView(dbKey) {
        const d = GM_getValue(dbKey) || { weeklyGoalCount:10, weeklyGoalScore:50 };
        const prefs = loadUIPrefs(); const stats = evaluateStats(d, prefs);
        const goalMode = prefs.goalMode||'count', goalCount = d.weeklyGoalCount||10, goalScore = d.weeklyGoalScore||50;
        const vMain = getVContent('main'); if(!vMain) return;
        const lastSync = GM_getValue('last_manual_sync_ts',0);
        const cooling = Date.now()-lastSync < SYNC_FREEZE_LIMIT;
        const remain = Math.ceil((SYNC_FREEZE_LIMIT-(Date.now()-lastSync))/1000);
        let progHtml = '';
        if (goalMode!=='score') { const p=Math.min(100,(stats.count/goalCount)*100).toFixed(1); progHtml+=`<div style="text-align:center;font-size:24px;font-weight:800">📊 题数 ${stats.count} / ${goalCount}</div><div class="hm-progress"><div class="hm-bar" style="width:${p}%"></div></div>`; }
        if (goalMode!=='count') { const p=Math.min(100,(stats.score/goalScore)*100).toFixed(1); progHtml+=`<div style="text-align:center;font-size:24px;font-weight:800">⭐ 得分 ${stats.score.toFixed(1)} / ${goalScore}</div><div class="hm-progress"><div class="hm-bar" style="width:${p}%"></div></div>`; }
        if (goalMode==='either') progHtml+='<div style="text-align:center;opacity:0.6;font-size:14px;margin-bottom:12px">任一达标即视为完成</div>';

        vMain.innerHTML = `
            <div class="hm-text-premium hm-view-title">🎯 致境·OI</div>
            ${progHtml}
            <div style="display:flex;justify-content:center;gap:16px;font-size:15px;font-weight:800;opacity:0.6;margin-bottom:16px">${prefs.lg?`<span>LG:${d.weeklySolvedPids?.length||0}</span>`:''}${prefs.cf?`<span>CF:${d.cfWeeklySolvedPids?.length||0}</span>`:''}${prefs.at?`<span>AT:${d.atWeeklySolvedPids?.length||0}</span>`:''}${prefs.lc?`<span>LC:${(d.lcWeeklySolvedPids||[]).length||0}</span>`:''}${prefs.uva?`<span>UVA:${(d.uvaWeeklySolvedPids||[]).length||0}</span>`:''}</div>
            <div id="hm-mood-card" style="margin:12px 0;padding:12px;background:rgba(255,255,255,0.15);border-radius:20px;text-align:center">
                <div id="hm-mood-emoji" style="font-size:32px"></div><div id="hm-mood-text" class="hm-text-premium" style="font-size:16px;margin-top:6px"></div>
            </div>
            <div id="hm-quote" style="opacity:0.65;margin:12px 0;text-align:center;font-style:italic;font-size:15px;min-height:40px">正在感悟中...</div>
            ${(d.contestOnlyPids||[]).length>0?`<div style="font-size:14px;color:#c62828;background:rgba(255,235,235,0.7);padding:10px;border-radius:16px;margin-bottom:12px;text-align:center">⚠️ ${d.contestOnlyPids.length} 题仅在比赛中</div>`:''}
            <button id="hm-toggle-detail" class="hm-glass-btn" style="margin-bottom:12px">📋 查看本周 AC 明细</button>
            <div id="hm-ac-detail-panel" class="hm-ac-detail" style="display:none"></div>
            <button id="hm-sync" class="hm-glass-btn hm-glass-btn-primary" style="margin-bottom:12px" ${cooling?'disabled':''}>${cooling?`思考中 (${remain}s)`:'全网同步'}</button>
            <div style="display:flex;gap:12px;margin-bottom:10px;">
                <button id="hm-data-btn" class="hm-glass-btn">📈 数据</button>
                <button id="hm-report-btn" class="hm-glass-btn">📋 报告</button>
                <button id="hm-set" class="hm-glass-btn">⚙️ 设置</button>
            </div>
        `;

        const updateMood = () => {
            const goal = goalMode==='score'?goalScore:goalCount, val = goalMode==='score'?stats.score:stats.count, prog = Math.min(100,(val/goal)*100);
            const emojiEl=document.getElementById('hm-mood-emoji'), textEl=document.getElementById('hm-mood-text'); if(!emojiEl||!textEl) return;
            let e='',t='';
            if(prog<=0){e='😴';t='新的一周，好好休息。';} else if(prog<30){e='🌱';t='破土时刻，每步都算数。';} else if(prog<70){e='🔥';t='渐入佳境，专注发光。';} else if(prog<100){e='🚀';t='就差临门一脚。';} else{e='👑';t='本周征途达成！';}
            emojiEl.textContent=e; textEl.innerHTML=`${t}<br><span style="font-size:14px;opacity:0.7">「行而不辍，未来可期。」</span>`;
        };
        updateMood();

        if (prefs.hitokotoMode !== 'none') {
            setTimeout(() => {
                GM_xmlhttpRequest({ method:"GET", url:prefs.hitokotoApi||'https://v1.hitokoto.cn/?c=d&c=i&c=k', onload:(res)=>{
                    const el=document.getElementById('hm-quote'); if(!el)return;
                    try{const q=JSON.parse(res.responseText); let cnt=q.hitokoto||q.text||q.content||q.quote; let fr=(q.from_who?q.from_who+' ':'')+(q.from?`《${q.from}》`:''); el.innerText=prefs.hitokotoMode==='sentence'||!fr?`✨ "${cnt}"`:`✨ "${cnt}"\n—— ${fr}`;}catch(e){el.innerText=`✨ "${res.responseText.trim().substring(0,60)}"`;}
                }});
            }, 300);
        }

        let detailVisible=false;
        document.getElementById('hm-toggle-detail').onclick=()=>{
            const panel=document.getElementById('hm-ac-detail-panel');
            if(!detailVisible){
                const allAc=[...d.weeklySolvedPids.map(p=>({platform:'LG',id:p.id,link:`https://www.luogu.com.cn/problem/${p.id}`})),...d.cfWeeklySolvedPids.map(p=>({platform:'CF',id:p.id,link:`https://codeforces.com/problemset/problem/${p.id.slice(0,-1)}/${p.id.slice(-1)}`})),...d.atWeeklySolvedPids.map(p=>({platform:'AT',id:p.id,link:`https://atcoder.jp/contests/${p.id.split('_')[0]}/tasks/${p.id}`}))];
                let html='<div style="display:flex;gap:6px;margin-bottom:10px;padding-top:4px;">';
                ['全部','LG','CF','AT'].forEach(t=>{html+=`<button class="hm-filter-btn hm-glass-btn" data-filter="${t}" style="padding:4px 12px;font-size:14px;border-radius:12px">${t}</button>`;});
                html+='</div><div id="hm-ac-list">'+allAc.map(ac=>`<div class="hm-ac-card" data-platform="${ac.platform}"><span style="font-weight:700">${ac.platform}</span><span style="font-size:15px">${ac.id}</span><a href="${ac.link}" target="_blank">打开</a></div>`).join('')+(allAc.length===0?'<div style="text-align:center;opacity:0.6;font-size:15px">暂无记录</div>':'')+'</div>';
                panel.innerHTML=html; panel.style.display='block'; detailVisible=true;
                panel.querySelectorAll('.hm-filter-btn').forEach(b=>b.onclick=()=>{const f=b.dataset.filter; panel.querySelectorAll('.hm-ac-card').forEach(c=>c.style.display=(f==='全部'||c.dataset.platform===f)?'':'none');});
                setTimeout(()=>adjustMainWidgetSize(),30);
                document.getElementById('hm-toggle-detail').innerText='📋 收起明细';
            }else{ panel.style.display='none'; detailVisible=false; document.getElementById('hm-toggle-detail').innerText='📋 查看本周 AC 明细'; setTimeout(()=>adjustMainWidgetSize(),30); }
        };
        document.getElementById('hm-sync').onclick=()=>startIncrementalTrace(dbKey,false);
        document.getElementById('hm-set').onclick=()=>transitionTo('settings');
        document.getElementById('hm-data-btn').onclick=()=>transitionTo('data');
        document.getElementById('hm-report-btn').onclick=()=>transitionTo('report');
        adjustMainWidgetSize();
    }

    function renderDataView(dbKey) {
        const d = GM_getValue(dbKey) || { weeklyHistory:[] };
        const history = d.weeklyHistory||[];
        let histHtml = '';
        if(history.length>0){
            const max=Math.max(...history.map(h=>h.count),1);
            histHtml=history.map(h=>{const pct=(h.count/max*100).toFixed(0); return `<div style="display:flex;align-items:center;margin-bottom:8px"><span style="width:85px;font-size:14px">${h.weekStart}</span><div style="flex:1;height:22px;background:rgba(255,255,255,0.2);border-radius:12px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--hm-blue);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;color:white">${h.count}题</div></div></div>`}).join('');
        } else histHtml='<div style="opacity:0.6;text-align:center;font-size:16px">暂无历史数据</div>';
        const platforms=[{name:'LG',count:d.weeklySolvedPids?.length||0,color:'#3498db'},{name:'CF',count:d.cfWeeklySolvedPids?.length||0,color:'#e74c3c'},{name:'AT',count:d.atWeeklySolvedPids?.length||0,color:'#2ecc71'}].filter(p=>p.count>0);
        const total=platforms.reduce((s,p)=>s+p.count,0); let conic='conic-gradient('; let acc=0;
        platforms.forEach((p,i)=>{const deg=(p.count/total*360).toFixed(1); conic+=`${p.color} ${acc}deg ${acc+parseFloat(deg)}deg`; if(i<platforms.length-1) conic+=', '; acc+=parseFloat(deg);}); conic+=')';
        getVContent('data').innerHTML=`
            <div class="hm-text-premium hm-view-title">📈 我的数据</div>
            <div style="display:flex;gap:30px">
                <div style="flex:1"><h4 style="font-size:18px;margin:10px 0">📊 历史周题数</h4>${histHtml}</div>
                <div style="flex:1"><h4 style="font-size:18px;margin:10px 0">🍩 本周平台分布</h4>
                    <div style="display:flex;align-items:center;gap:16px"><div style="width:80px;height:80px;border-radius:50%;background:${conic}"></div><div style="flex:1;font-size:15px">${platforms.map(p=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="width:12px;height:12px;background:${p.color};border-radius:4px"></span> ${p.name} ${p.count}题</div>`).join('')}</div></div>
                </div>
            </div>
            <button id="hm-back-from-data" class="hm-glass-btn" style="margin-top:20px">↩️ 返回</button>
        `;
        document.getElementById('hm-back-from-data').onclick=()=>transitionTo('main');
    }

    function renderReportView() {
        const d = GM_getValue(dbKey)||{dailyRecords:{}}; const prefs=loadUIPrefs();
        const today=new Date().toISOString().slice(0,10); const todayCount=d.dailyRecords?.[today]||0; const stats=evaluateStats(d,prefs);
        let streak=0; for(let i=0;i<365;i++){const day=new Date(Date.now()-i*86400000).toISOString().slice(0,10); if(d.dailyRecords?.[day]&&d.dailyRecords[day]>0) streak++; else break;}
        const highest=()=>{let max={diff:0,id:''}; d.weeklySolvedPids?.forEach(p=>{if((p.diff||0)>max.diff)max={diff:p.diff,id:p.id}}); return max.id?`${max.id} (${max.diff})`:'无';};
        getVContent('report').innerHTML=`
            <div class="hm-text-premium hm-view-title">📋 今日报告</div>
            <div style="display:flex;align-items:center;gap:30px">
                <div style="text-align:center;flex:1"><div style="font-size:54px">${todayCount>0?'✅':'🌙'}</div><div style="font-size:20px;font-weight:800;margin-top:10px">今日 AC ${todayCount} 题</div><div style="opacity:0.5;font-size:14px;margin-top:6px">${today}</div></div>
                <div style="flex:2;background:rgba(255,255,255,0.15);border-radius:20px;padding:16px;font-size:16px">
                    <div style="margin-bottom:8px">🔥 连续打卡：${streak} 天</div><div style="margin-bottom:8px">🏆 今日最高难度：${highest()}</div>
                    <div style="font-style:italic;text-align:center;margin:16px 0">${todayCount>0?(todayCount>=6?'效率起飞 ✨':todayCount>=3?'非常专注 🎯':'稳步向前 🌿'):'蓄力的一天 ⚡'}</div>
                </div>
            </div>
            <button id="hm-back-from-report" class="hm-glass-btn" style="margin-top:20px">↩️ 返回</button>
        `;
        document.getElementById('hm-back-from-report').onclick=()=>transitionTo('main');
    }

    function renderSettingsView(dbKey) {
        const d = GM_getValue(dbKey)||{weeklyGoalCount:10,weeklyGoalScore:50};
        const c = getConfig(); const prefs=loadUIPrefs();
        let curH=c.h||0, curM=c.m||0;
        const settingItem = (label, hint, innerHtml) => `
            <div class="hm-setting-item">
                <label class="hm-label">${label}</label>
                <span class="hm-hint">${hint}</span>
                ${innerHtml}
            </div>
        `;
        getVContent('settings').innerHTML = `
            <div class="hm-text-premium hm-view-title">⚙️ 设置</div>
            <div class="hm-settings-group">
                ${settingItem('你的昵称', '显示在卡片上', `<input id="s-name" class="hm-input" value="${c.name}">`)}
                ${settingItem('征程启航日', '每周从这一天开始统计', `<div class="hm-segment" id="week-segment">${["日","一","二","三","四","五","六"].map((d,i)=>`<button class="hm-segment-btn ${i===c.d?'active':''}" data-index="${i}">${d}</button>`).join('')}</div>`)}
                ${settingItem('启航时间 (支持滚轮微调)', '精确到分钟', `<div style="display:flex;align-items:center;justify-content:center;gap:20px;background:rgba(255,255,255,var(--hm-glass-alpha));padding:12px;border-radius:20px;border:1px solid var(--hm-border)"><div style="display:flex;flex-direction:column;align-items:center;gap:4px"><button id="hm-time-h-up" class="hm-glass-btn" style="padding:4px 20px;font-size:14px">▲</button><span id="hm-time-h-val" style="font-size:28px;font-weight:800;cursor:pointer">${String(curH).padStart(2,'0')}</span><button id="hm-time-h-dn" class="hm-glass-btn" style="padding:4px 20px;font-size:14px">▼</button></div><span style="font-size:28px;opacity:0.4">:</span><div style="display:flex;flex-direction:column;align-items:center;gap:4px"><button id="hm-time-m-up" class="hm-glass-btn" style="padding:4px 20px;font-size:14px">▲</button><span id="hm-time-m-val" style="font-size:28px;font-weight:800;cursor:pointer">${String(curM).padStart(2,'0')}</span><button id="hm-time-m-dn" class="hm-glass-btn" style="padding:4px 20px;font-size:14px">▼</button></div></div>`)}
            </div>
            <div class="hm-settings-group">
                ${settingItem('Luogu UID', '自动检测，也可手动填写', `<input id="s-lg" class="hm-input" value="${c.lg||''}">`)}
                ${settingItem('Codeforces 账号', '填写你的 CF 用户名', `<input id="s-cf" class="hm-input" value="${c.cf||''}">`)}
                ${settingItem('AtCoder 账号', '填写你的 AtCoder 用户名', `<input id="s-at" class="hm-input" value="${c.at||''}">`)}
            </div>
            <div class="hm-settings-group">
                ${settingItem('达标判定', '选择目标判定规则', `<div class="hm-segment" id="goal-mode-segment">${[{val:'count',txt:'仅题数'},{val:'score',txt:'仅分数'},{val:'both',txt:'全达标'},{val:'either',txt:'任一达标'}].map(o=>`<button class="hm-segment-btn ${prefs.goalMode===o.val?'active':''}" data-value="${o.val}">${o.txt}</button>`).join('')}</div>`)}
                ${settingItem('每周题数目标', '目标 AC 总数', `<input id="s-goal-count" type="number" class="hm-input" value="${d.weeklyGoalCount||10}">`)}
                ${settingItem('每周分数目标', '目标总得分', `<input id="s-goal-score" type="number" class="hm-input" value="${d.weeklyGoalScore||50}">`)}
            </div>
            <div class="hm-settings-group">
                <label class="hm-label">🎨 外观</label>
                <div class="hm-switch-row"><span>高级液态玻璃</span><label class="hm-switch"><input type="checkbox" id="ui-glass" ${prefs.liquidGlass?'checked':''}><span class="hm-slider-toggle"></span></label></div>
                <div class="hm-switch-row"><span>启用拖拽物理引擎</span><label class="hm-switch"><input type="checkbox" id="ui-physics" ${prefs.physicsEnabled?'checked':''}><span class="hm-slider-toggle"></span></label></div>
                <div class="hm-switch-row"><span>边缘吸附自动隐藏</span><label class="hm-switch"><input type="checkbox" id="ui-edge-hide" ${prefs.edgeHideEnabled?'checked':''}><span class="hm-slider-toggle"></span></label></div>
                ${settingItem('深色模式', '', `<div class="hm-segment" id="dark-mode-segment">${[{val:'light',txt:'浅色'},{val:'dark',txt:'深色'},{val:'auto',txt:'跟随系统'}].map(o=>`<button class="hm-segment-btn ${prefs.darkMode===o.val?'active':''}" data-value="${o.val}">${o.txt}</button>`).join('')}</div>`)}
                ${settingItem('悬浮球图标', 'Emoji或图片链接', `<input id="ui-icon" class="hm-input" value="${prefs.icon}">`)}
                ${settingItem('默认视图', '', `<div class="hm-segment" id="default-view-segment">${[{val:'main',txt:'主面板'},{val:'data',txt:'数据'},{val:'report',txt:'报告'}].map(o=>`<button class="hm-segment-btn ${prefs.defaultView===o.val?'active':''}" data-value="${o.val}">${o.txt}</button>`).join('')}</div>`)}
                ${settingItem('双击附加动作', '双击悬浮球必定会展开界面，同时可附加以下操作', `<div class="hm-segment" id="dblclick-segment">${[{val:'none',txt:'无'},{val:'sync',txt:'触发全网同步'}].map(o=>`<button class="hm-segment-btn ${(prefs.ballDoubleClick==='sync' && o.val==='sync') || (prefs.ballDoubleClick!=='sync' && o.val==='none')?'active':''}" data-value="${o.val}">${o.txt}</button>`).join('')}</div>`)}
            </div>
            <div class="hm-settings-group">
                <label class="hm-label">🧠 AI 引擎独立设置 (混合调度)</label>
                <span class="hm-hint" style="margin-bottom:16px;">选择 DeepSeek 或 Gemini 会自动唤起网页版，无须 API Key。选择“内置免费”则全程后台无感。</span>
                ${settingItem('🤖 AI 教我偏好', '', `<div class="hm-segment" id="ai-teach-segment">${[{val:'builtin',txt:'内置免费'},{val:'deepseek',txt:'DeepSeek'},{val:'gemini',txt:'Gemini'},{val:'ask',txt:'每次询问'}].map(o=>`<button class="hm-segment-btn ${prefs.aiTeachEngine===o.val?'active':''}" data-value="${o.val}">${o.txt}</button>`).join('')}</div>`)}
                ${settingItem('✨ 简化题意偏好', '', `<div class="hm-segment" id="ai-simplify-segment">${[{val:'builtin',txt:'内置免费'},{val:'deepseek',txt:'DeepSeek'},{val:'gemini',txt:'Gemini'},{val:'ask',txt:'每次询问'}].map(o=>`<button class="hm-segment-btn ${prefs.aiSimplifyEngine===o.val?'active':''}" data-value="${o.val}">${o.txt}</button>`).join('')}</div>`)}
            </div>
            <div style="display:flex;gap:12px"><button id="s-save" class="hm-glass-btn hm-glass-btn-primary" style="flex:2">💾 保存刷新</button><button id="s-back" class="hm-glass-btn" style="flex:1">❌ 取消</button></div>
        `;
        getVContent('settings').addEventListener('click', (e) => {
            const btn = e.target.closest('.hm-segment-btn'); if (!btn) return;
            const seg = btn.closest('.hm-segment'); if (!seg) return;
            seg.querySelectorAll('.hm-segment-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
        });
        const updateTime = () => { document.getElementById('hm-time-h-val').innerText = String(curH).padStart(2,'0'); document.getElementById('hm-time-m-val').innerText = String(curM).padStart(2,'0'); };
        document.getElementById('hm-time-h-up').onclick = () => { curH = (curH+1)%24; updateTime(); };
        document.getElementById('hm-time-h-dn').onclick = () => { curH = (curH-1+24)%24; updateTime(); };
        document.getElementById('hm-time-m-up').onclick = () => { curM = (curM+1)%60; updateTime(); };
        document.getElementById('hm-time-m-dn').onclick = () => { curM = (curM-1+60)%60; updateTime(); };
        const handleTimeScroll = (el, type) => {
            el.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.deltaY > 0) { if (type === 'h') curH = (curH - 1 + 24) % 24; else curM = (curM - 1 + 60) % 60; }
                else { if (type === 'h') curH = (curH + 1) % 24; else curM = (curM + 1) % 60; }
                updateTime();
            }, { passive: false });
        };
        handleTimeScroll(document.getElementById('hm-time-h-val'), 'h');
        handleTimeScroll(document.getElementById('hm-time-m-val'), 'm');

        document.getElementById('s-save').onclick = () => {
            const newConfig = { ...c, name: document.getElementById('s-name').value.trim()||'OIer', d: parseInt(document.querySelector('#week-segment .active')?.dataset.index||c.d), h: curH, m: curM,
                lg: document.getElementById('s-lg').value.trim(), cf: document.getElementById('s-cf').value.trim(), at: document.getElementById('s-at').value.trim(),
                weeklyGoalCount: parseInt(document.getElementById('s-goal-count').value)||10, weeklyGoalScore: parseInt(document.getElementById('s-goal-score').value)||50,
                goalMode: document.querySelector('#goal-mode-segment .active')?.dataset.value||'count' };
            GM_setValue('yu_config', newConfig);
            const newPrefs = { ...prefs,
                liquidGlass: document.getElementById('ui-glass').checked, physicsEnabled: document.getElementById('ui-physics').checked, edgeHideEnabled: document.getElementById('ui-edge-hide').checked,
                darkMode: document.querySelector('#dark-mode-segment .active')?.dataset.value || 'auto', icon: document.getElementById('ui-icon').value.trim() || '🎯',
                defaultView: document.querySelector('#default-view-segment .active')?.dataset.value || 'main', ballDoubleClick: document.querySelector('#dblclick-segment .active')?.dataset.value || 'none',
                aiTeachEngine: document.querySelector('#ai-teach-segment .active')?.dataset.value || 'builtin',
                aiSimplifyEngine: document.querySelector('#ai-simplify-segment .active')?.dataset.value || 'builtin'
            };
            GM_setValue(UI_PREFS_KEY, newPrefs); currentUIPrefs = loadUIPrefs(); refreshDynamicStyles();
            d.weeklyGoalCount = newConfig.weeklyGoalCount; d.weeklyGoalScore = newConfig.weeklyGoalScore;
            if (c.lg!==newConfig.lg || c.cf!==newConfig.cf || c.at!==newConfig.at) d.lastSync = 0;
            GM_setValue(dbKey, d); transitionTo('main'); resetEdgeTimer();
        };
        document.getElementById('s-back').onclick = () => transitionTo('main');
    }

    let isDragging = false, dragMoved = false, dragAnimId = null;
    let pointerX, pointerY, offsetX, offsetY, startX, startY;
    let curL, curT;

    widget.addEventListener('mousedown', e => {
        if (currentState !== 'ball' && !e.target.closest('.hm-drag-zone')) return;
        isDragging = true; dragMoved = false;
        pointerX = e.clientX; pointerY = e.clientY;
        startX = e.clientX; startY = e.clientY;
        const rect = widget.getBoundingClientRect();
        offsetX = pointerX - rect.left;
        offsetY = pointerY - rect.top;
        curL = rect.left; curT = rect.top;

        widget.style.transition = 'none';

        if (dragAnimId) cancelAnimationFrame(dragAnimId);
        const dragPhysLoop = () => {
            if (!isDragging) return;
            if (currentUIPrefs.physicsEnabled) {
                const targetL = pointerX - offsetX;
                const targetT = pointerY - offsetY;
                curL += (targetL - curL) * 0.4;
                curT += (targetT - curT) * 0.4;
            } else {
                curL = pointerX - offsetX;
                curT = pointerY - offsetY;
            }
            widget.style.left = curL + 'px';
            widget.style.top = curT + 'px';
            dragAnimId = requestAnimationFrame(dragPhysLoop);
        };
        dragAnimId = requestAnimationFrame(dragPhysLoop);
        window.addEventListener('mousemove', dragMove, { passive: true });
        window.addEventListener('mouseup', dragEnd, { passive: true });
    }, { passive: true });

    const dragMove = (e) => {
        pointerX = e.clientX; pointerY = e.clientY;
        if (Math.abs(pointerX - startX) > 5 || Math.abs(pointerY - startY) > 5) dragMoved = true;
    };

    const dragEnd = () => {
        window.removeEventListener('mousemove', dragMove);
        window.removeEventListener('mouseup', dragEnd);
        isDragging = false;
        widget.style.transition = '';
        if (dragMoved) {
            const rect = widget.getBoundingClientRect();
            let finalL = Math.max(20, Math.min(window.innerWidth - rect.width - 20, rect.left));
            let finalT = Math.max(20, Math.min(window.innerHeight - rect.height - 20, rect.top));
            widget.style.left = finalL + 'px';
            widget.style.top = finalT + 'px';
            resetEdgeTimer();
        }
    };

    let clickTimer = null;
    widget.addEventListener('click', (e) => {
        if (dragMoved) return;
        if (currentState !== 'ball') return;

        if (clickTimer) {
            clearTimeout(clickTimer); clickTimer = null;
            // 【核心修复】：双击一定会打开界面！如果配置了同步，则在后台同步。
            const action = currentUIPrefs.ballDoubleClick || 'none';
            if (action === 'sync') startIncrementalTrace(dbKey, false);
            transitionTo(currentUIPrefs.defaultView || 'main');
        } else {
            clickTimer = setTimeout(() => {
                clickTimer = null;
                transitionTo(currentUIPrefs.defaultView || 'main');
            }, 250);
        }
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        if(resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (currentState === 'ball') {
                const rect = widget.getBoundingClientRect();
                let finalL = Math.max(20, Math.min(window.innerWidth - rect.width - 20, rect.left));
                let finalT = Math.max(20, Math.min(window.innerHeight - rect.height - 20, rect.top));
                widget.style.left = finalL + 'px'; widget.style.top = finalT + 'px';
            } else adjustMainWidgetSize();
        }, 100);
    }, { passive: true });

    autoDetectAndSave();
    let d = GM_getValue(dbKey);
    if (!d || Date.now() >= (d.nextResetTime||0)) {
        archiveWeeklyData();
        d = { weeklyGoalCount:10, weeklyGoalScore:50, nextResetTime: getBoundaries().next, lastSync:0, weeklySolvedPids:[], cfWeeklySolvedPids:[], atWeeklySolvedPids:[], dailyRecords:{} };
        GM_setValue(dbKey, d);
    }
    widget.style.opacity='1'; widget.style.pointerEvents='auto';
    resetEdgeTimer();
})();
