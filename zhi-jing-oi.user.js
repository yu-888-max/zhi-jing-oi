// @updateURL https://raw.githubusercontent.com/yu-888-max/zhi-jing-oi/main/zhi-jing-oi.user.js
// ==UserScript==
// @name         致境·OI
// @namespace    http://yu666.luogu.goal
// @version      4.1Beta
// @description  这就是 4.1，一个从古诗文筋骨里长出来的、真正高阶级的刷题伴侣。它不堆砌神兽，而是把垂天、倚天、钧衡、万象、崑冈、惊鸿这些刻在我们文化基因里的意象，锻造成了现代工程学的灵魂。
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
// @connect      *
// @run-at       document-end
// @icon         https://www.luogu.com.cn/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    // =================== 🤖 AI 教我 (多平台集成) ===================
    const STORE_MD = 'luogu_md_v8';
    const STORE_PEND = 'luogu_pending_v8';
    const STORE_AI_TYPE = 'luogu_pending_ai_type';

    const buildPromptMessage = (md) => `C++教我一下，请用不太现代化（避免auto、lambda等）、易懂的代码风格解答。
要求：
1. 先讲清楚题目在问什么，给出解题思路
2. 逐步推导，解释每一步为什么这样做
3. 给出完整代码，关键行加上注释
4. 最后分析时间复杂度和空间复杂度

题目如下：\n\n${md}`;

    // DeepSeek 注入逻辑
    if (location.hostname === 'chat.deepseek.com') {
        if (!GM_getValue(STORE_PEND, false) || GM_getValue(STORE_AI_TYPE, '') !== 'deepseek') return;
        GM_deleteValue(STORE_PEND); GM_deleteValue(STORE_AI_TYPE);
        const md = GM_getValue(STORE_MD, ''); if (!md) return;

        function waitForEditorDS(cb) {
            const ta = document.querySelector('textarea[placeholder*="DeepSeek"]');
            if (ta) return cb(ta);
            setTimeout(() => waitForEditorDS(cb), 400);
        }

        async function enableExpertMode(retries = 8) {
            for (let i = 0; i < retries; i++) {
                const radio = document.querySelector('[data-model-type="expert"][role="radio"]');
                if (radio) {
                    if (radio.getAttribute('aria-checked') !== 'true') radio.click();
                    return;
                }
                await new Promise(r => setTimeout(r, 500));
            }
        }

        waitForEditorDS(async (ta) => {
            await enableExpertMode();
            const message = buildPromptMessage(md);
            const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
            setter.call(ta, message);
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => {
                ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
                GM_deleteValue(STORE_MD);
            }, 300);
        });
        return;
    }

    // Gemini 注入逻辑
    if (location.hostname === 'gemini.google.com') {
        if (!GM_getValue(STORE_PEND, false) || GM_getValue(STORE_AI_TYPE, '') !== 'gemini') return;
        GM_deleteValue(STORE_PEND); GM_deleteValue(STORE_AI_TYPE);
        const md = GM_getValue(STORE_MD, ''); if (!md) return;

        function waitForEditorGemini(cb) {
            const editor = document.querySelector('rich-textarea div[contenteditable="true"]') || document.querySelector('.ql-editor') || document.querySelector('div[contenteditable="true"][role="textbox"]');
            if (editor) return cb(editor);
            setTimeout(() => waitForEditorGemini(cb), 500);
        }

        waitForEditorGemini((editor) => {
            const message = buildPromptMessage(md);
            editor.focus();
            document.execCommand('insertText', false, message);
            setTimeout(() => {
                const sendBtn = document.querySelector('button[aria-label*="Send"], button[aria-label*="发送"], .send-button');
                if (sendBtn && !sendBtn.disabled) sendBtn.click();
                GM_deleteValue(STORE_MD);
            }, 800);
        });
        return;
    }

    // 洛谷题目页面植入 AI 按钮
    if (location.hostname === 'www.luogu.com.cn' && location.pathname.startsWith('/problem/')) {
        function addAIBotButton() {
            const actionsBar = document.querySelector('.problem-block-actions') || document.querySelector('.operation');
            if (!actionsBar) { setTimeout(addAIBotButton, 500); return; }
            if (document.getElementById('ai-help-btn')) return;

            const btn = document.createElement('a');
            btn.id = 'ai-help-btn'; btn.href = 'javascript:void 0';
            btn.style.cssText = 'margin-left:12px;color:#4f46e5;font-weight:bold;cursor:pointer;text-decoration:none;';
            btn.innerHTML = '🤖 AI 教我';

            btn.onclick = () => {
                const origWrite = navigator.clipboard.writeText;
                let captured = '';
                navigator.clipboard.writeText = (text) => { captured = text; navigator.clipboard.writeText = origWrite; return Promise.resolve(); };

                const copyLink = actionsBar.querySelector('a[href="javascript:void 0"]');
                if (!copyLink) { alert('未找到复制 Markdown 按钮，请刷新页面后重试'); return; }
                copyLink.click();

                setTimeout(() => {
                    navigator.clipboard.writeText = origWrite;
                    if (!captured || captured.trim().length < 10) { alert('复制失败，请手动复制后再尝试'); return; }
                    GM_setValue(STORE_MD, captured);

                    // 无缝衔接切换至悬浮标内展开的 AI 老师选择器
                    transitionTo('ai');
                }, 200);
            };
            actionsBar.appendChild(btn);
        }
        addAIBotButton();
    }

    // =================== 致境·OI 主体架构 ===================
    const SYNC_FREEZE_LIMIT = 3 * 60 * 1000;
    const AUTO_CHECK_LIMIT = 60 * 60 * 1000;
    const dbKey = 'zhi_jing_oi_data';
    const UI_PREFS_KEY = 'hm_ui_prefs';

    const DEFAULT_UI_PREFS = {
        physicsEnabled: true,
        liquidGlass: true,
        constrainToScreen: true,
        icon: '🎯',
        hitokotoMode: 'both',
        hitokotoApi: 'https://v1.hitokoto.cn/?c=d&c=i&c=k',
        glassOpacity: 0.35,
        accentColor: '#007DFF',
        darkMode: 'auto',
        fontFamily: '',
        backgroundImageUrl: '',
        edgeHideEnabled: true
    };

    function loadUIPrefs() { return { ...DEFAULT_UI_PREFS, ...GM_getValue(UI_PREFS_KEY, {}) }; }

    function getConfig() {
        const def = {
            name: 'OIer',
            d: 1, h: 0, m: 0,
            lg: '', cf: '', at: '', lc: '', uva: '',
            w_en: false,
            lg_w: [1,1,2,3,4,5,6,8],
            cf_w: 400,
            at_w: 100,
            uva_w: 1,
            weeklyGoal: 10
        };
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
        GM_setValue(dbKey, d);
    }
    migrateData();

    function evaluateStats(d, c) {
        let count = 0, score = 0;
        const lArr = d.weeklySolvedPids || [], cArr = d.cfWeeklySolvedPids || [], aArr = d.atWeeklySolvedPids || [], lcArr = d.lcWeeklySolvedPids || [], uArr = d.uvaWeeklySolvedPids || [];
        count = lArr.length + cArr.length + aArr.length + lcArr.length + uArr.length;
        const lg_w = c.lg_w || [1,1,2,3,4,5,6,8];
        lArr.forEach(p => { let diff = parseInt(p.diff) || 0; score += parseFloat(lg_w[Math.max(0, Math.min(7, diff))] || 1); });
        cArr.forEach(p => { let r = parseFloat(p.rating) || 0; score += r > 0 ? (r / (c.cf_w || 400)) : 1; });
        aArr.forEach(p => { let pt = parseFloat(p.point) || 0; score += pt > 0 ? (pt / (c.at_w || 100)) : 1; });
        lcArr.forEach(() => score += 1);
        uArr.forEach(() => score += parseFloat(c.uva_w || 1));
        return { count, score };
    }

    function archiveWeeklyData() {
        const d = GM_getValue(dbKey); if (!d) return;
        const stats = evaluateStats(d, getConfig()), history = d.weeklyHistory || [];
        history.push({ weekStart: new Date(getBoundaries().last).toISOString().slice(0,10), count: stats.count, score: stats.score });
        if (history.length > 8) history.shift();
        d.weeklyHistory = history; GM_setValue(dbKey, d);
    }

    function autoDetectAndSave() {
        let config = getConfig(), updated = false, host = window.location.hostname;
        if (host.includes('luogu.com')) {
            const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            let uid = w._feInjection?.currentUser?.uid || w._headerData?.currentUser?.uid || w._LuoguConfig?.uid;
            if (!uid) { const m = document.cookie.match(/(?:^|;)\s*_uid=(\d+)/); uid = m ? m[1] : null; }
            if (uid && config.lg !== String(uid)) { config.lg = String(uid); updated = true; }
        } else if (host.includes('codeforces.com')) {
            const cfNode = document.querySelector('.lang-chooser a[href^="/profile/"]');
            if (cfNode) { let cfHandle = cfNode.innerText.trim(); if (cfHandle && config.cf !== cfHandle) { config.cf = cfHandle; updated = true; } }
        } else if (host.includes('atcoder.jp')) {
            const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window; let atHandle = w.userScreenName;
            if (!atHandle) { const atNode = document.querySelector('.navbar a[href^="/users/"]'); if (atNode) { const m = atNode.getAttribute('href').match(/\/users\/([^\/]+)/); if (m) atHandle = m[1]; } }
            if (atHandle && config.at !== atHandle) { config.at = atHandle; updated = true; }
        } else if (host.includes('leetcode.cn')) {
            try { const sd = JSON.parse(localStorage.getItem('userStatus') || '{}'); if (sd.username && config.lc !== sd.username) { config.lc = sd.username; updated = true; } } catch(e) {}
        }
        if (updated) GM_setValue('yu_config', config); return config;
    }

    const safeWait = (ms) => new Promise(r => setTimeout(r, ms + Math.random() * 400));
    async function fetchOS(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({ method: "GET", url, headers: { "x-lentille-request": "content-only" },
                onload: res => { const t = res.responseText; if (t.includes('decodeURIComponent')) { const m = t.match(/decodeURIComponent\("([^"]+)"\)/); if (m) return resolve(JSON.parse(decodeURIComponent(m[1]))); } try { resolve(JSON.parse(t)); } catch (e) { resolve(null); } }, onerror: () => resolve(null) });
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
        const bound = getBoundaries(), userData = GM_getValue(dbKey) || { weeklyGoal: 10, weeklySolvedPids: [] }, config = getConfig();
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
        let lcPidsMap = new Map((userData.lcWeeklySolvedPids || []).map(p => [p.id, p]));
        let uvaPidsMap = new Map((userData.uvaWeeklySolvedPids || []).map(p => [p.id, p]));

        const logCompact = (msg, sub) => {
            if (!silent && currentState === 'main') {
                const vMain = document.getElementById('hm-view-main');
                vMain.innerHTML = `
                    <div class="hm-drag-zone" style="padding:12px 15px 8px; margin:0 0 8px;">
                        <div class="hm-drag-handle" style="margin-bottom:8px;"></div>
                        <div class="hm-text-premium" style="font-size:18px; text-align:center;">🌟 深度溯源中...</div>
                    </div>
                    <div class="sync-log" style="padding:12px 15px; margin-bottom:12px; font-size:13px;">
                        ${msg}<br><span style="opacity:0.6; font-size:12px;">${sub}</span>
                    </div>
                    <div style="width:100%; height:4px; background:rgba(0,0,0,0.05); border-radius:10px; overflow:hidden; margin-bottom:12px;">
                        <div style="width:40%; height:100%; background:var(--hm-blue); border-radius:10px; animation:hm-scan 1.5s infinite linear;"></div>
                    </div>
                `;
                adjustMainWidgetSize();
            }
        };

        try {
            if (config.lg) {
                let page = 1, foundPotential = new Map(), stop = false;
                while (!stop && page <= 8) {
                    logCompact(`检索洛谷记录`, `第 ${page} 页`); await safeWait(600);
                    const data = await fetchOS(`https://www.luogu.com.cn/record/list?user=${config.lg}&status=12&page=${page}`);
                    const rs = data?.currentData?.records?.result || data?.records?.result || [];
                    if (!rs.length) break;
                    for (let r of rs) { if (r.submitTime * 1000 <= stopBoundary) { stop = true; break; } if (r.problem?.pid) foundPotential.set(r.problem.pid, r.problem.difficulty || 0); }
                    if (!stop) page++;
                }
                let pids = Array.from(foundPotential.keys());
                for (let i = 0; i < pids.length; i++) {
                    const pid = pids[i]; if (weeklyPidsMap.has(pid)) continue;
                    logCompact(`校验题目库`, `${i+1}/${pids.length} - [${pid}]`); await safeWait(600);
                    const d = await fetchOS(`https://www.luogu.com.cn/record/list?user=${config.lg}&pid=${pid}&status=12&page=1`);
                    const allRs = d?.currentData?.records?.result || d?.records?.result || [];
                    const prac = allRs.filter(r => !r.contest && (r.submitTime * 1000 >= bound.last));
                    const cont = allRs.filter(r => r.contest && (r.submitTime * 1000 >= bound.last));
                    if (prac.length > 0) {
                        const total = d?.currentData?.records?.count || d?.records?.count || 0; let isFirst = true;
                        if (total > 1) { await safeWait(400); const dL = await fetchOS(`https://www.luogu.com.cn/record/list?user=${config.lg}&pid=${pid}&status=12&page=${Math.ceil(total/20)}`); const hist = dL?.currentData?.records?.result || dL?.records?.result || []; const fPrac = hist.reverse().find(r => !r.contest); if (fPrac && fPrac.submitTime * 1000 < bound.last) isFirst = false; }
                        if (isFirst) weeklyPidsMap.set(pid, { id: pid, diff: foundPotential.get(pid) });
                    } else if (cont.length > 0) { if (!weeklyPidsMap.has(pid)) contestOnlyPids.add(pid); }
                }
            }
            if (config.cf) {
                logCompact(`同步 Codeforces`, config.cf); await safeWait(800);
                const cfRes = await new Promise(res => GM_xmlhttpRequest({ method: "GET", url: `https://codeforces.com/api/user.status?handle=${config.cf}&from=1&count=60`, onload: r => res(JSON.parse(r.responseText)), onerror: () => res(null) }));
                if (cfRes?.status === "OK") for (let s of cfRes.result) { if (s.creationTimeSeconds * 1000 < bound.last) break; if (s.verdict === "OK") cfPidsMap.set(`${s.problem.contestId}${s.problem.index}`, { id: `${s.problem.contestId}${s.problem.index}`, rating: s.problem.rating || 0 }); }
            }
            if (config.at) {
                logCompact(`同步 AtCoder`, config.at); await safeWait(800);
                const atRes = await new Promise(res => GM_xmlhttpRequest({ method: "GET", url: `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${config.at}&from_second=${Math.floor(bound.last/1000)}`, onload: r => res(JSON.parse(r.responseText)), onerror: () => res(null) }));
                if (Array.isArray(atRes)) atRes.forEach(s => { if (s.result === "AC") atPidsMap.set(s.problem_id, { id: s.problem_id, point: s.point || 0 }); });
            }
            if (config.lc) {
                logCompact(`同步 LeetCode`, config.lc); await safeWait(800);
                const lcRes = await new Promise(res => GM_xmlhttpRequest({ method: "POST", url: "https://leetcode.cn/graphql/", headers: { "Content-Type": "application/json" }, data: JSON.stringify({ query: `query recentAcSubmissions($username: String!) { recentAcSubmissionList(username: $username) { id titleSlug timestamp } }`, variables: { username: config.lc } }), onload: r => { try { res(JSON.parse(r.responseText)); } catch(e) { res(null); } }, onerror: () => res(null) }));
                (lcRes?.data?.recentAcSubmissionList || []).forEach(sub => { if (sub.timestamp * 1000 >= bound.last) lcPidsMap.set(sub.id, { id: sub.id, title: sub.titleSlug }); });
            }
            if (config.uva) {
                logCompact(`同步 UVA`, config.uva); await safeWait(800);
                let uid = config.uva;
                if (isNaN(uid)) { const uidRes = await new Promise(res => GM_xmlhttpRequest({ method: "GET", url: `https://uhunt.onlinejudge.org/api/uname2uid/${config.uva}`, onload: r => res(r.responseText.trim()), onerror: () => res(null) })); if (uidRes && !isNaN(uidRes) && uidRes !== "0") uid = uidRes; }
                if (!isNaN(uid) && uid !== "0") {
                    const uvaRes = await new Promise(res => GM_xmlhttpRequest({ method: "GET", url: `https://uhunt.onlinejudge.org/api/subs-user/${uid}`, onload: r => { try { res(JSON.parse(r.responseText)); } catch(e){ res(null); } }, onerror: () => res(null) }));
                    if (uvaRes && uvaRes.subs) {
                        let nSlv = []; for (let s of uvaRes.subs) if (s[4] * 1000 >= bound.last && s[2] === 90) nSlv.push(s[1]);
                        if (nSlv.length > 0) {
                            const pDets = await new Promise(res => GM_xmlhttpRequest({ method: "GET", url: `https://uhunt.onlinejudge.org/api/p/id/${Array.from(new Set(nSlv)).join(',')}`, onload: r => { try { res(JSON.parse(r.responseText)); } catch(e){ res(null); } }, onerror: () => res(null) }));
                            if (Array.isArray(pDets)) pDets.forEach(pd => { uvaPidsMap.set(pd[0], { id: pd[1], internalId: pd[0] }); }); else nSlv.forEach(id => { if (!uvaPidsMap.has(id)) uvaPidsMap.set(id, { id: `UVA-${id}`, internalId: id }); });
                        }
                    }
                }
            }

            userData.weeklySolvedPids = Array.from(weeklyPidsMap.values());
            userData.cfWeeklySolvedPids = Array.from(cfPidsMap.values());
            userData.atWeeklySolvedPids = Array.from(atPidsMap.values());
            userData.lcWeeklySolvedPids = Array.from(lcPidsMap.values());
            userData.uvaWeeklySolvedPids = Array.from(uvaPidsMap.values());
            userData.contestOnlyPids = [...contestOnlyPids];
            userData.lastSync = Date.now(); userData.nextResetTime = bound.next;

            const today = new Date().toISOString().slice(0,10);
            if (!userData.dailyRecords) userData.dailyRecords = {};
            if (!userData.dailyRecords[today]) { const tNew = userData.weeklySolvedPids.length+userData.cfWeeklySolvedPids.length+userData.atWeeklySolvedPids.length+userData.lcWeeklySolvedPids.length+userData.uvaWeeklySolvedPids.length; if (tNew > 0) userData.dailyRecords[today] = tNew; }

            GM_setValue(dbKey, userData); if (currentState === 'main') renderMainView(dbKey);
        } catch (e) { console.error(e); }
    }

    // ===================== 核心样式定制 =====================
    const styleEl = document.createElement('style');
    function updateDynamicStyles() {
        const p = currentUIPrefs;
        const dark = p.darkMode === 'dark' || (p.darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const bgLight = dark ? '#1c1c1e' : '#ffffff'; const glassBg = dark ? 'rgba(28,28,30,0.5)' : 'rgba(255,255,255,0.45)';
        const textCol = dark ? '#f5f5f7' : '#1d1d1f'; const textSec = dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
        const borderCol = dark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.75)'; const font = p.fontFamily || '"HarmonyOS Sans", "SF Pro Display", system-ui';

        styleEl.innerHTML = `
        :root { --hm-blue: ${p.accentColor}; --hm-glass-alpha: ${p.glassOpacity}; --hm-bg: ${bgLight}; --hm-glass-bg: ${glassBg}; --hm-text: ${textCol}; --hm-text-secondary: ${textSec}; --hm-border: ${borderCol}; --hm-font: ${font}; --hm-bg-image: ${p.backgroundImageUrl?`url(${p.backgroundImageUrl})`:'none'}; }
        #hm-widget, #hm-widget * { box-sizing: border-box !important; user-select: none !important; -webkit-user-drag: none !important; font-family: var(--hm-font), sans-serif; }
        #hm-widget { position: fixed; z-index: 9999999; background: var(--hm-bg); color: var(--hm-text); }
        #hm-widget.hm-glass { background: linear-gradient(135deg, var(--hm-glass-bg) 0%, rgba(230,240,250,0.2) 100%); backdrop-filter: blur(16px) saturate(120%); -webkit-backdrop-filter: blur(16px) saturate(120%); border: 1px solid var(--hm-border); box-shadow: 0 16px 40px rgba(0,0,0,${dark?0.4:0.1}); transition: width 0.7s cubic-bezier(0.25, 1, 0.3, 1), height 0.7s cubic-bezier(0.25, 1, 0.3, 1), left 0.7s cubic-bezier(0.25, 1, 0.3, 1), top 0.7s cubic-bezier(0.25, 1, 0.3, 1), border-radius 0.7s cubic-bezier(0.25, 1, 0.3, 1), opacity 0.4s ease, background 0.3s, color 0.3s; }
        #hm-widget.hm-glass::before { content:''; position:absolute; top:0; left:0; width:100%; height:100%; background-image:var(--hm-bg-image); background-size:cover; background-position:center; opacity:0.1; pointer-events:none; border-radius:inherit; z-index:-1; }
        .is-ball { border-radius: 50% !important; cursor: move !important; } .is-panel { border-radius: 36px !important; cursor: default !important; overflow: hidden; }
        .hm-view { position: absolute; top:50%; left:50%; transform:translate(-50%, -50%); opacity:0; pointer-events:none; visibility:hidden; transition: opacity 0.3s ease; }
        .hm-view.active { opacity:1; pointer-events:auto; visibility:visible; }
        #hm-view-ball { width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:var(--hm-blue); font-size:34px; text-shadow:0 2px 8px rgba(0,125,255,0.3); }
        #hm-view-main { width:380px; padding: 30px 35px 35px 35px; height:auto; display:block !important; }
        #hm-view-settings { width:380px; display:flex; flex-direction:column; height:auto; max-height:85vh; }
        #hm-view-ai { width:320px; height:auto; display:flex; flex-direction:column; }
        .hm-settings-scroll { flex:1; overflow-y:auto; padding:0 35px 35px 35px; } .hm-settings-scroll::-webkit-scrollbar { width:4px; } .hm-settings-scroll::-webkit-scrollbar-thumb { background:rgba(128,128,128,0.3); border-radius:10px; }
        .hm-text-premium { color:var(--hm-text); font-weight:800; letter-spacing:-0.5px; text-shadow:0 1px 1px rgba(255,255,255,0.8); }
        .hm-label { display:block; text-align:left; font-size:14px; margin:0 0 8px 10px; font-weight:700; color:var(--hm-text-secondary); }
        .hm-drag-zone { cursor:grab; margin:0 0 10px 0; padding:20px 15px 10px 15px; border-radius:20px; transition:background 0.3s; } .hm-drag-zone:hover { background:rgba(128,128,128,0.1); } .hm-drag-zone:active { cursor:grabbing; }
        .hm-drag-handle { width:50px; height:6px; background:rgba(128,128,128,0.3); border-radius:3px; margin:0 auto 15px auto; }
        .hm-input, .hm-glass-btn { width:100%; padding:16px 22px; border-radius:20px; background:rgba(255,255,255,var(--hm-glass-alpha)); border:1px solid var(--hm-border); box-shadow:inset 0 3px 6px rgba(255,255,255,0.5),0 8px 20px rgba(0,0,0,0.08); outline:none; font-size:16px; color:var(--hm-text); font-weight:700; cursor:pointer; transition:all 0.3s; }
        .hm-input:focus { border-color:var(--hm-blue); background:rgba(255,255,255,0.8); }
        .hm-glass-btn:hover:not(:disabled) { background:rgba(255,255,255,calc(var(--hm-glass-alpha) + 0.1)); transform:translateY(-1px); }
        .hm-glass-btn-primary { background:linear-gradient(135deg, ${p.accentColor}66, ${p.accentColor}99); border:1px solid rgba(255,255,255,0.5); color:white; text-shadow:0 1px 2px rgba(0,0,0,0.2); } .hm-glass-btn-primary:hover:not(:disabled) { background:linear-gradient(135deg, ${p.accentColor}88, ${p.accentColor}bb); }
        .hm-glass-btn:disabled { opacity:0.5; cursor:wait; }
        .hm-progress { width:100%; height:16px; background:rgba(255,255,255,0.3); border-radius:20px; overflow:hidden; margin:12px 0 15px; border:1px solid rgba(255,255,255,0.8); } .hm-bar { height:100%; background:linear-gradient(90deg, #1d1d1f, #4a4a4d); transition:width 1s cubic-bezier(0.2,1.1,0.4,1); }
        .hm-switch { position:relative; display:inline-block; width:48px; height:26px; } .hm-switch input { opacity:0; width:0; height:0; }
        .hm-slider-toggle { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:rgba(128,128,128,0.3); transition:.3s; border-radius:28px; border:1px solid rgba(255,255,255,0.5); }
        .hm-slider-toggle:before { position:absolute; content:""; height:20px; width:20px; left:2px; bottom:2px; background:white; transition:.3s; border-radius:50%; box-shadow:0 2px 5px rgba(0,0,0,0.2); }
        input:checked + .hm-slider-toggle { background:var(--hm-blue); } input:checked + .hm-slider-toggle:before { transform:translateX(22px); }
        .hm-segment { display:flex; gap:8px; width:100%; background:rgba(255,255,255,0.2); padding:4px; border-radius:20px; border:1px solid rgba(255,255,255,0.3); margin-bottom:15px; } .hm-segment-btn { flex:1; padding:10px 4px; border-radius:18px; font-weight:700; font-size:13px; color:var(--hm-text); background:transparent; border:none; cursor:pointer; transition:all 0.25s; text-align:center; } .hm-segment-btn:hover { background:rgba(255,255,255,0.4); } .hm-segment-btn.active { background:rgba(255,255,255,0.8); box-shadow:0 2px 8px rgba(0,0,0,0.1); color:var(--hm-blue); }
        .hm-color-input-row { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,var(--hm-glass-alpha)); border:1px solid var(--hm-border); border-radius:20px; padding:8px 12px; margin-bottom:20px; box-shadow:inset 0 3px 6px rgba(255,255,255,0.5),0 8px 20px rgba(0,0,0,0.08); } .hm-color-swatch { width:36px; height:36px; border-radius:50%; box-shadow:0 2px 8px rgba(0,0,0,0.15); border:2px solid rgba(255,255,255,0.8); } .hm-color-input { flex:1; background:transparent; border:none; font-size:16px; font-weight:700; color:var(--hm-text); outline:none; font-family:monospace; }
        .hm-action-group { display:flex; width:100%; border-radius:20px; overflow:hidden; box-shadow:0 8px 20px rgba(0,0,0,0.08); } .hm-action-group .hm-glass-btn { margin:0; box-shadow:none; border-radius:0; border-right:1px solid rgba(255,255,255,0.4); } .hm-action-group .hm-glass-btn:last-child { border-right:none; border-radius:0 20px 20px 0; } .hm-action-group .hm-glass-btn:first-child { border-radius:20px 0 0 20px; }
        .sync-log { font-size:13px; background:rgba(255,255,255,0.3); padding:15px; border-radius:20px; margin-bottom:15px; border:1px solid rgba(255,255,255,0.9); }
        @keyframes hm-scan { 0% { transform:translateX(-100%); } 100% { transform:translateX(250%); } }
        .hm-ac-detail { margin-top:12px; max-height: min(280px, 40vh); overflow-y: auto; padding-right: 4px; }
        .hm-ac-detail::-webkit-scrollbar { width: 6px; }
        .hm-ac-detail::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); border-radius: 10px; }
        .hm-ac-detail::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.3); border-radius: 10px; }
        .hm-ac-card { display:flex; align-items:center; padding:6px 10px; margin-bottom:5px; background:rgba(255,255,255,0.2); border-radius:12px; gap:10px; font-size:13px; color:var(--hm-text); border:1px solid rgba(255,255,255,0.2); } .hm-ac-card a { color:var(--hm-blue); text-decoration:none; font-weight:700; }
        #hm-welcome-overlay { position:fixed; inset:0; background:rgba(247,249,250,0.75); z-index:9999998; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; overflow:hidden; transition:opacity 0.8s; pointer-events:none; opacity:0; } #hm-welcome-overlay.show { opacity:1; pointer-events:auto; }
        .hm-orb { position:absolute; border-radius:50%; filter:blur(90px); background:radial-gradient(circle, var(--hm-blue), #66B1FF); opacity:0.15; z-index:-1; } .orb-1 { width:60vw; height:60vw; top:-15%; left:-10%; animation:hm-orb-move 30s infinite alternate ease-in-out; } .orb-2 { width:50vw; height:50vw; bottom:-10%; right:-5%; animation:hm-orb-move 35s infinite alternate-reverse ease-in-out; }
        @keyframes hm-orb-move { 0% { transform:translate(0,0) scale(1); } 100% { transform:translate(8%,5%) scale(1.15); } }
        @keyframes hm-popIn { 0% { transform: scale(0.5); opacity:0; } 100% { transform: scale(1); opacity:1; } }
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
            if (!/^https?:\/\//i.test(src) && !src.startsWith('data:') && !src.startsWith('/') && !src.startsWith('./')) {
                src = 'https://' + src;
            }
            ball.innerHTML = `<img src="${src}" alt="icon" style="width:40px; height:40px; object-fit:contain; filter:drop-shadow(0 2px 8px rgba(0,125,255,0.3)); border-radius:50%;">`;
        } else {
            ball.textContent = str || '🎯';
        }
    }

    // ===================== UI 框架与物理核心 =====================
    let currentState = 'ball';
    const hmOverlay = document.createElement('div');
    hmOverlay.id = 'hm-widget-overlay';
    hmOverlay.style.cssText = `position:fixed; inset:0; background:rgba(0,0,0,0.3); z-index:9999998; backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); opacity:0; pointer-events:none; transition:opacity 0.4s ease;`;
    document.body.appendChild(hmOverlay);

    const widget = document.createElement('div'); widget.id = 'hm-widget'; widget.className = 'hm-glass is-ball';
    widget.style.cssText = `width:68px; height:68px; left:${window.innerWidth-100}px; top:${window.innerHeight-100}px; opacity:0; pointer-events:none;`;
    const vBall = document.createElement('div'); vBall.id = 'hm-view-ball'; vBall.className = 'hm-view active';
    const vMain = document.createElement('div'); vMain.id = 'hm-view-main'; vMain.className = 'hm-view';
    const vSettings = document.createElement('div'); vSettings.id = 'hm-view-settings'; vSettings.className = 'hm-view';
    const vAI = document.createElement('div'); vAI.id = 'hm-view-ai'; vAI.className = 'hm-view';
    widget.append(vBall, vMain, vSettings, vAI); document.body.appendChild(widget);
    if (!currentUIPrefs.liquidGlass) widget.classList.add('no-glass');
    updateBallIcon(currentUIPrefs.icon); refreshDynamicStyles();

    function smartUpdateWidgetPos(targetH, targetW = 380) {
        const rect = widget.getBoundingClientRect();
        let nextL = Math.max(20, Math.min(window.innerWidth-targetW-20, (rect.left+rect.width/2)-targetW/2));
        let nextT = Math.max(20, Math.min(window.innerHeight-targetH-20, (rect.top+rect.height/2)-targetH/2));
        widget.style.width = targetW+'px'; widget.style.height = targetH+'px'; widget.style.left = nextL+'px'; widget.style.top = nextT+'px';
        if (currentState === 'settings') {
            const scrollDiv = document.querySelector('#hm-view-settings .hm-settings-scroll');
            const header = document.querySelector('#hm-view-settings .hm-drag-zone');
            if (scrollDiv) scrollDiv.style.maxHeight = (targetH - (header?header.offsetHeight+40:80))+'px';
        }
    }
    function adjustMainWidgetSize() {
        if (currentState !== 'main') return;
        const v = document.getElementById('hm-view-main');
        if (!v) return;
        const targetH = Math.min(v.scrollHeight, window.innerHeight * 0.85);
        smartUpdateWidgetPos(targetH, 380);
    }

    let edgeTimer = null, widgetVisible = true, edgeOriginalLeft = null;
    window.addEventListener('resize', () => { if (edgeOriginalLeft !== null && !widgetVisible) { widget.style.left = edgeOriginalLeft + 'px'; edgeOriginalLeft = null; widget.style.opacity = '1'; widgetVisible = true; resetEdgeTimer(); } });

    function resetEdgeTimer() {
        if (!currentUIPrefs.edgeHideEnabled || currentState !== 'ball') {
            if (edgeTimer) clearTimeout(edgeTimer);
            if (edgeOriginalLeft !== null) { widget.style.left = edgeOriginalLeft + 'px'; edgeOriginalLeft = null; }
            widget.style.opacity = '1'; widgetVisible = true; return;
        }
        if (edgeTimer) clearTimeout(edgeTimer);
        if (edgeOriginalLeft !== null) { widget.style.left = edgeOriginalLeft + 'px'; edgeOriginalLeft = null; }
        widget.style.opacity = '1'; widgetVisible = true;

        edgeTimer = setTimeout(() => {
            if (currentState === 'ball' && !isDragging) {
                widget.style.opacity = '0.3'; widgetVisible = false; const rect = widget.getBoundingClientRect();
                edgeOriginalLeft = rect.left;
                widget.style.left = rect.left + rect.width/2 < window.innerWidth/2 ? `-${rect.width * 0.4}px` : `${window.innerWidth - rect.width * 0.6}px`;
            }
        }, 3000);
    }

    widget.addEventListener('mouseenter', () => { if (currentUIPrefs.edgeHideEnabled && !widgetVisible) { if (edgeOriginalLeft !== null) { widget.style.left = edgeOriginalLeft + 'px'; edgeOriginalLeft = null; } widget.style.opacity='1'; widgetVisible=true; } resetEdgeTimer(); });
    widget.addEventListener('mouseleave', resetEdgeTimer);

    function transitionTo(viewName) {
        if (viewName === 'main') renderMainView(dbKey);
        if (viewName === 'settings') renderSettingsView(dbKey);
        if (viewName === 'ai') renderAIView();

        requestAnimationFrame(() => {
            let tW = 68, tH = 68;
            if (viewName !== 'ball') {
                const v = document.getElementById('hm-view-' + viewName);
                if (viewName === 'settings') {
                    const scrollContent = v.querySelector('.hm-settings-scroll');
                    const header = v.querySelector('.hm-drag-zone');
                    tW = 380;
                    tH = Math.min((header?header.offsetHeight+40:80)+(scrollContent?scrollContent.scrollHeight:0), window.innerHeight*0.85);
                } else if (viewName === 'ai') {
                    tW = 320;
                    v.style.width = tW + 'px';
                    tH = v.scrollHeight;
                } else {
                    tW = 380;
                    tH = Math.min(v.scrollHeight, window.innerHeight*0.85);
                }
            }
            if (viewName === 'ball') {
                const r = widget.getBoundingClientRect();
                widget.style.left = (r.left+(r.width-68)/2)+'px';
                widget.style.top = (r.top+(r.height-68)/2)+'px';
                widget.style.width='68px';
                widget.style.height='68px';
                updateBallIcon(currentUIPrefs.icon);
            } else {
                smartUpdateWidgetPos(tH, tW);
            }
            widget.classList.toggle('is-ball', viewName === 'ball'); widget.classList.toggle('is-panel', viewName !== 'ball');
            document.querySelectorAll('.hm-view').forEach(v => v.classList.remove('active')); document.getElementById('hm-view-' + viewName).classList.add('active');
            currentState = viewName;

            if (viewName === 'ai') {
                hmOverlay.style.opacity = '1';
                hmOverlay.style.pointerEvents = 'auto';
            } else {
                hmOverlay.style.opacity = '0';
                hmOverlay.style.pointerEvents = 'none';
            }

            resetEdgeTimer();
        });
    }

    function renderAIView() {
        const vAI = document.getElementById('hm-view-ai');
        if (!vAI || vAI.innerHTML) return;
        vAI.innerHTML = `
            <div style="padding: 10px 25px 30px; text-align:center; display:flex; flex-direction:column; gap:15px;">
                <div style="font-size:48px; margin-bottom:5px; animation: hm-popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);">🤖</div>
                <h3 class="hm-text-premium" style="margin:0 0 10px 0; font-size:22px; letter-spacing:-0.5px;">选择 AI 老师</h3>
                <button id="hm-btn-ai-ds" class="hm-glass-btn hm-glass-btn-primary" style="font-size:16px; padding:15px; border-radius:18px;">DeepSeek (推荐)</button>
                <button id="hm-btn-ai-gemini" class="hm-glass-btn" style="font-size:16px; padding:15px; border-radius:18px;">Gemini (多模态解析)</button>
            </div>
        `;

        document.getElementById('hm-btn-ai-ds').onclick = () => {
            GM_setValue(STORE_PEND, true); GM_setValue(STORE_AI_TYPE, 'deepseek');
            transitionTo('ball'); window.open('https://chat.deepseek.com/', '_blank');
        };
        document.getElementById('hm-btn-ai-gemini').onclick = () => {
            GM_setValue(STORE_PEND, true); GM_setValue(STORE_AI_TYPE, 'gemini');
            transitionTo('ball'); window.open('https://gemini.google.com/app', '_blank');
        };
    }

    function renderMainView(dbKey) {
        const d = GM_getValue(dbKey) || { weeklyGoal: 10 }, config = getConfig(), curStats = evaluateStats(d, config);
        const isScorePrimary = config.w_en, primaryVal = isScorePrimary ? curStats.score.toFixed(1).replace('.0','') : curStats.count;
        const prog = Math.min(100, ((isScorePrimary ? curStats.score : curStats.count) / d.weeklyGoal)*100).toFixed(1);
        const vMain = document.getElementById('hm-view-main'); if(!vMain) return;
        const lastSync = GM_getValue('last_manual_sync_ts',0), cooling = Date.now()-lastSync < SYNC_FREEZE_LIMIT, remain = Math.ceil((SYNC_FREEZE_LIMIT - (Date.now()-lastSync))/1000);

        vMain.innerHTML = `
            <div class="hm-drag-zone"><div class="hm-drag-handle"></div><div class="hm-text-premium" style="text-align:center;font-size:20px;">🎯 致境·OI</div></div>
            <div class="hm-text-premium" style="font-size:64px;text-align:center;margin:5px 0;line-height:1.1;">${isScorePrimary?`<span style="font-size:24px;opacity:0.6;">得分 </span>${primaryVal}`:primaryVal}<span style="font-size:24px;opacity:0.3;">/ ${d.weeklyGoal}</span></div>
            <div style="text-align:center;font-size:14px;font-weight:800;color:var(--hm-blue);margin:5px 0 15px;opacity:0.8;">${isScorePrimary?`共 AC ${curStats.count} 题`:`总得分 ${curStats.score.toFixed(1)}`}</div>
            <div style="display:flex;justify-content:center;gap:10px;font-size:13px;font-weight:800;opacity:0.6;">${config.lg?`<span>LG:${d.weeklySolvedPids?.length||0}</span>`:''}${config.cf?`<span>CF:${d.cfWeeklySolvedPids?.length||0}</span>`:''}${config.at?`<span>AT:${d.atWeeklySolvedPids?.length||0}</span>`:''}${config.lc?`<span>LC:${d.lcWeeklySolvedPids?.length||0}</span>`:''}${config.uva?`<span>UVA:${d.uvaWeeklySolvedPids?.length||0}</span>`:''}</div>
            <div class="hm-progress"><div class="hm-bar" style="width:${prog}%"></div></div>
            <div id="hm-quote" class="hm-text-premium" style="opacity:0.65;margin:15px 0;text-align:center;font-style:italic;font-size:14px;min-height:40px;${currentUIPrefs.hitokotoMode==='none'?'display:none':''}">正在感悟中...</div>
            ${(d.contestOnlyPids||[]).length>0?`<div style="font-size:13px;color:#c62828;background:rgba(255,235,235,0.7);padding:12px;border-radius:20px;margin-bottom:15px;text-align:center;">⚠️ ${d.contestOnlyPids.length} 题洛谷记录仅在比赛中，需在练习模式提交一次。</div>`:''}
            <button id="hm-toggle-detail" class="hm-glass-btn" style="width:100%; margin-bottom:10px;">📋 查看本周 AC 明细</button>
            <div id="hm-ac-detail-panel" class="hm-ac-detail" style="display:none;"></div>
            <div class="hm-action-group">
                <button id="hm-sync" class="hm-glass-btn hm-glass-btn-primary" style="flex:1;" ${cooling?'disabled':''}>${cooling?`思考中 (${remain}s)`:'全网同步'}</button>
                <button id="hm-set" class="hm-glass-btn" style="width:52px;display:flex;align-items:center;justify-content:center;">⚙️</button>
            </div>
        `;

        if (currentUIPrefs.hitokotoMode !== 'none') {
            GM_xmlhttpRequest({ method:"GET", url:currentUIPrefs.hitokotoApi || 'https://v1.hitokoto.cn/?c=d&c=i&c=k', onload:(res)=>{
                const el=document.getElementById('hm-quote'); if(!el)return;
                try { const q=JSON.parse(res.responseText); let cnt=q.hitokoto||q.text||q.content||q.quote||"解析失败"; let fr=(q.from_who?q.from_who+' ':'')+(q.from?`《${q.from}》`:''); el.innerHTML = currentUIPrefs.hitokotoMode==='sentence'||!fr?`✨ "${cnt}"`:`✨ "${cnt}"<br><small style="font-style:normal;opacity:0.7;">—— ${fr}</small>`; } catch(e) { el.innerHTML=`✨ "${res.responseText.trim().substring(0,60)}"`; }
            }});
        }

        let detailVisible = false;
        const toggleBtn = document.getElementById('hm-toggle-detail');
        const panel = document.getElementById('hm-ac-detail-panel');
        toggleBtn.addEventListener('click', () => {
            if (!detailVisible) {
                const allAc = [
                    ...(d.weeklySolvedPids||[]).map(p=>({platform:'LG',id:p.id,link:`https://www.luogu.com.cn/problem/${p.id}`})),
                    ...(d.cfWeeklySolvedPids||[]).map(p=>({platform:'CF',id:p.id,link:`https://codeforces.com/problemset/problem/${p.id.slice(0,-1)}/${p.id.slice(-1)}`})),
                    ...(d.atWeeklySolvedPids||[]).map(p=>({platform:'AT',id:p.id,link:`https://atcoder.jp/contests/${p.id.split('_')[0]}/tasks/${p.id}`})),
                    ...(d.lcWeeklySolvedPids||[]).map(p=>({platform:'LC',id:p.title||p.id,link:`https://leetcode.cn/problems/${p.title||''}`})),
                    ...(d.uvaWeeklySolvedPids||[]).map(p=>({platform:'UVA',id:p.id,link:p.internalId?`https://onlinejudge.org/index.php?option=com_onlinejudge&Itemid=8&page=show_problem&problem=${p.internalId}`:'#'}))
                ];
                panel.innerHTML = allAc.map(ac=>`<div class="hm-ac-card"><span style="font-weight:700;">${ac.platform}</span><span>${ac.id}</span><a href="${ac.link}" target="_blank">打开</a></div>`).join('') + (allAc.length === 0 ? '<div style="text-align:center;opacity:0.6;">暂无记录</div>' : '');
                panel.style.display = 'block';
                toggleBtn.innerText = '📋 收起明细';
                detailVisible = true;
                setTimeout(() => adjustMainWidgetSize(), 30);
            } else {
                panel.style.display = 'none';
                toggleBtn.innerText = '📋 查看本周 AC 明细';
                detailVisible = false;
                setTimeout(() => adjustMainWidgetSize(), 30);
            }
        });

        document.getElementById('hm-sync').onclick = () => startIncrementalTrace(dbKey, false);
        document.getElementById('hm-set').onclick = () => transitionTo('settings');

        if(cooling) {
            const timer=setInterval(()=>{
                const btn=document.getElementById('hm-sync'); if(!btn){clearInterval(timer);return;}
                const sec=Math.ceil((SYNC_FREEZE_LIMIT-(Date.now()-GM_getValue('last_manual_sync_ts',0)))/1000);
                if(sec<=0){ btn.disabled=false; btn.innerText='全网同步'; clearInterval(timer); } else btn.innerText=`思考中 (${sec}s)`;
            },1000);
        }
        adjustMainWidgetSize();
    }

    function renderSettingsView(dbKey) {
        const d = GM_getValue(dbKey) || { weeklyGoal:10 }, c = getConfig(), prefs = loadUIPrefs();
        const vSettings = document.getElementById('hm-view-settings');
        let curH = c.h || 0, curM = c.m || 0;

        vSettings.innerHTML = `
            <div class="hm-drag-zone" style="padding:20px 20px 10px 20px; margin:30px 35px 10px 35px;"><div class="hm-drag-handle"></div><div class="hm-text-premium" style="font-size:22px;text-align:center;">⚙️ 设置</div></div>
            <div class="hm-settings-scroll">
                <label class="hm-label">你的昵称</label>
                <input id="s-name" class="hm-input" value="${c.name}" style="margin-bottom:20px;" placeholder="OIer">

                <label class="hm-label">每周目标 (${c.w_en?'目标分数':'目标题数'})</label>
                <input id="s-g" type="number" class="hm-input" value="${d.weeklyGoal}" style="margin-bottom:20px;">

                <label class="hm-label">征程启航日</label>
                <div class="hm-segment" id="week-segment">
                    ${["日","一","二","三","四","五","六"].map((day,i)=>`<button class="hm-segment-btn ${i===c.d?'active':''}" data-index="${i}">${day}</button>`).join('')}
                </div>

                <label class="hm-label">启航时间</label>
                <div style="display:flex; align-items:center; justify-content:center; gap:20px; margin-bottom:20px; background:rgba(255,255,255,var(--hm-glass-alpha)); padding:15px; border-radius:20px; border:1px solid var(--hm-border); box-shadow:inset 0 3px 6px rgba(255,255,255,0.5),0 8px 20px rgba(0,0,0,0.08);">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
                        <button id="hm-time-h-up" class="hm-glass-btn" style="padding:6px 20px; min-width:unset; border-radius:12px; font-size:12px;">▲</button>
                        <span id="hm-time-h-val" style="font-size:28px; font-weight:800; font-family:monospace; color:var(--hm-text); text-shadow:0 1px 2px rgba(0,0,0,0.1); width:40px; text-align:center;">${String(c.h).padStart(2,'0')}</span>
                        <button id="hm-time-h-dn" class="hm-glass-btn" style="padding:6px 20px; min-width:unset; border-radius:12px; font-size:12px;">▼</button>
                    </div>
                    <span style="font-size:28px; font-weight:800; color:var(--hm-text); opacity:0.4; padding-bottom:4px;">:</span>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
                        <button id="hm-time-m-up" class="hm-glass-btn" style="padding:6px 20px; min-width:unset; border-radius:12px; font-size:12px;">▲</button>
                        <span id="hm-time-m-val" style="font-size:28px; font-weight:800; font-family:monospace; color:var(--hm-text); text-shadow:0 1px 2px rgba(0,0,0,0.1); width:40px; text-align:center;">${String(c.m).padStart(2,'0')}</span>
                        <button id="hm-time-m-dn" class="hm-glass-btn" style="padding:6px 20px; min-width:unset; border-radius:12px; font-size:12px;">▼</button>
                    </div>
                </div>

                <div style="margin:25px 0 10px;height:1px;background:rgba(0,0,0,0.05);"></div>
                <label class="hm-label">Luogu UID</label><input id="s-lg" class="hm-input" value="${c.lg||''}" style="margin-bottom:15px;">
                <label class="hm-label">Codeforces 账号</label><input id="s-cf" class="hm-input" value="${c.cf||''}" style="margin-bottom:15px;">
                <label class="hm-label">AtCoder 账号</label><input id="s-at" class="hm-input" value="${c.at||''}" style="margin-bottom:15px;">
                <label class="hm-label">LeetCode 账号</label><input id="s-lc" class="hm-input" value="${c.lc||''}" style="margin-bottom:15px;">
                <label class="hm-label">UVA Username</label><input id="s-uva" class="hm-input" value="${c.uva||''}" style="margin-bottom:25px;">

                <div style="margin:25px 0 10px;height:1px;background:rgba(0,0,0,0.05);"></div>
                <label class="hm-label">📈 计分模式</label>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding:15px; background:rgba(255,255,255,var(--hm-glass-alpha)); border:1px solid var(--hm-border); border-radius:20px; box-shadow:inset 0 3px 6px rgba(255,255,255,0.5);">
                    <span style="font-weight:700; color:var(--hm-text);">启用按难度计分</span>
                    <label class="hm-switch"><input type="checkbox" id="set-weight-enable" ${c.w_en?'checked':''}><span class="hm-slider-toggle"></span></label>
                </div>

                <div style="margin:25px 0 10px;height:1px;background:rgba(0,0,0,0.05);"></div>
                <label class="hm-label">💬 一言定制</label>
                <div class="hm-segment" id="ui-hitokoto-segment">
                    ${[{val:'both',txt:'句+出处'},{val:'sentence',txt:'仅句子'},{val:'none',txt:'关闭'}].map(o=>`<button class="hm-segment-btn ${prefs.hitokotoMode===o.val?'active':''}" data-value="${o.val}">${o.txt}</button>`).join('')}
                </div>
                <div class="hm-segment" id="hitokoto-preset-segment">
                    <button class="hm-segment-btn" data-url="https://v1.hitokoto.cn/?c=d&c=i&c=k">诗词</button><button class="hm-segment-btn" data-url="https://v1.hitokoto.cn/?c=a&c=b&c=c">二次元</button><button class="hm-segment-btn" data-url="https://v1.hitokoto.cn/?c=x">代码</button><button class="hm-segment-btn" data-url="custom">自定义</button>
                </div>
                <input id="ui-hitokoto-custom" class="hm-input" style="margin-bottom:20px;font-size:13px;display:none;padding:12px;" value="${prefs.hitokotoApi||''}" placeholder="支持任何返回 JSON 的 API">

                <div style="margin:25px 0 10px;height:1px;background:rgba(0,0,0,0.05);"></div>
                <label class="hm-label">🎨 外观定制</label>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;padding:0 5px;"><span>液态玻璃效果</span><label class="hm-switch"><input type="checkbox" id="ui-glass" ${prefs.liquidGlass?'checked':''}><span class="hm-slider-toggle"></span></label></div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;padding:0 5px;"><span>滑动物理引擎</span><label class="hm-switch"><input type="checkbox" id="ui-physics" ${prefs.physicsEnabled?'checked':''}><span class="hm-slider-toggle"></span></label></div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;padding:0 5px;"><span>边缘吸附变淡</span><label class="hm-switch"><input type="checkbox" id="ui-edge-hide" ${prefs.edgeHideEnabled?'checked':''}><span class="hm-slider-toggle"></span></label></div>

                <label class="hm-label">深色模式</label>
                <div class="hm-segment" id="dark-mode-segment">${[{val:'light',txt:'浅色'},{val:'dark',txt:'深色'},{val:'auto',txt:'跟随系统'}].map(o=>`<button class="hm-segment-btn ${prefs.darkMode===o.val?'active':''}" data-value="${o.val}">${o.txt}</button>`).join('')}</div>
                <label class="hm-label" style="margin-top:10px;">字体 (留空默认)</label><input id="ui-font" class="hm-input" value="${prefs.fontFamily}" style="margin-bottom:15px;">
                <label class="hm-label">背景壁纸 URL</label><input id="ui-bg" class="hm-input" value="${prefs.backgroundImageUrl}" style="margin-bottom:15px;">
                <label class="hm-label">悬浮球图标</label><input id="ui-icon" class="hm-input" value="${prefs.icon}" style="margin-bottom:15px;">

                <label class="hm-label">主题色</label>
                <div class="hm-color-input-row" id="hm-color-trigger" style="cursor:pointer; margin-bottom:10px; transition:all 0.3s; padding:12px 15px;">
                    <div class="hm-color-swatch" id="hm-color-swatch" style="background:${prefs.accentColor}; width:32px; height:32px;"></div>
                    <span id="hm-color-text" style="flex:1; font-weight:700; font-size:15px; font-family:monospace; color:var(--hm-text);">${prefs.accentColor}</span>
                    <span id="hm-color-arrow" style="opacity:0.5; font-size:12px; margin-right:5px;">▼</span>
                </div>
                <div id="hm-color-palette" style="display:none; grid-template-columns:repeat(5, 1fr); gap:12px; margin-bottom:20px; background:rgba(255,255,255,var(--hm-glass-alpha)); padding:15px; border-radius:20px; border:1px solid var(--hm-border); box-shadow:inset 0 3px 6px rgba(255,255,255,0.5);">
                </div>

                <div style="margin:25px 0 10px;height:1px;background:rgba(0,0,0,0.05);"></div>
                <div style="display:flex; gap:10px; margin-bottom:20px;">
                    <button id="s-export" class="hm-glass-btn" style="flex:1; font-size:14px; padding:12px;">📤 导出配置</button>
                    <button id="s-import" class="hm-glass-btn" style="flex:1; font-size:14px; padding:12px;">📥 导入配置</button>
                </div>

                <button id="s-save" class="hm-glass-btn hm-glass-btn-primary" style="width:100%;">💾 保存并刷新</button>
                <button id="s-back" class="hm-glass-btn" style="width:100%; margin-top:10px;">❌ 取消</button>
            </div>
        `;

        let selectedDay = c.d;
        document.querySelectorAll('#week-segment .hm-segment-btn').forEach(btn => {
            btn.addEventListener('click', () => { document.querySelectorAll('#week-segment .hm-segment-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); selectedDay = parseInt(btn.dataset.index); });
        });

        const updateTimeDisplay = () => {
            document.getElementById('hm-time-h-val').innerText = String(curH).padStart(2,'0');
            document.getElementById('hm-time-m-val').innerText = String(curM).padStart(2,'0');
        };
        document.getElementById('hm-time-h-up').onclick = () => { curH = (curH + 1) % 24; updateTimeDisplay(); };
        document.getElementById('hm-time-h-dn').onclick = () => { curH = (curH - 1 + 24) % 24; updateTimeDisplay(); };
        document.getElementById('hm-time-m-up').onclick = () => { curM = (curM + 1) % 60; updateTimeDisplay(); };
        document.getElementById('hm-time-m-dn').onclick = () => { curM = (curM - 1 + 60) % 60; updateTimeDisplay(); };
        document.getElementById('hm-time-h-val').addEventListener('wheel', e => { e.preventDefault(); curH = (curH + (e.deltaY > 0 ? -1 : 1) + 24) % 24; updateTimeDisplay(); });
        document.getElementById('hm-time-m-val').addEventListener('wheel', e => { e.preventDefault(); curM = (curM + (e.deltaY > 0 ? -1 : 1) + 60) % 60; updateTimeDisplay(); });

        let selectedHitokoto = prefs.hitokotoMode;
        document.querySelectorAll('#ui-hitokoto-segment .hm-segment-btn').forEach(btn => { btn.addEventListener('click', () => { document.querySelectorAll('#ui-hitokoto-segment .hm-segment-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); selectedHitokoto = btn.dataset.value; }); });

        const hitoInput = document.getElementById('ui-hitokoto-custom'); let currentHitoUrl = prefs.hitokotoApi || 'https://v1.hitokoto.cn/?c=d&c=i&c=k', isHitoCustom = true;
        document.querySelectorAll('#hitokoto-preset-segment .hm-segment-btn').forEach(btn => {
            const url = btn.dataset.url; if (url !== 'custom' && currentHitoUrl === url) { btn.classList.add('active'); isHitoCustom = false; }
            btn.addEventListener('click', () => {
                document.querySelectorAll('#hitokoto-preset-segment .hm-segment-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
                if (url === 'custom') { hitoInput.style.display = 'block'; if (!hitoInput.value) hitoInput.value = 'https://'; } else { hitoInput.style.display = 'none'; currentHitoUrl = url; }
            });
        });
        if (isHitoCustom) { const cBtn = document.querySelector('#hitokoto-preset-segment .hm-segment-btn[data-url="custom"]'); if (cBtn) cBtn.classList.add('active'); hitoInput.style.display = 'block'; hitoInput.value = currentHitoUrl; }

        let selAcc = prefs.accentColor;
        const colors = ['#007DFF', '#34C759', '#FF9500', '#FF2D55', '#5856D6', '#AF52DE', '#FFCC00', '#00C7BE', '#A2845E', '#8E8E93'];
        const palette = document.getElementById('hm-color-palette');
        palette.innerHTML = colors.map(cc => `<div class="hm-palette-item" data-color="${cc}" style="width:100%; aspect-ratio:1; border-radius:50%; background:${cc}; cursor:pointer; border:2px solid rgba(255,255,255,0.8); box-shadow:0 2px 8px rgba(0,0,0,0.15); transition:transform 0.2s;"></div>`).join('') +
        `<input type="text" id="hm-color-custom-input" class="hm-input" placeholder="输入 HEX 如 #123456" style="grid-column:1/-1; margin-top:5px; text-align:center; padding:10px; font-size:14px;">`;

        let colorOpen = false;
        document.getElementById('hm-color-trigger').onclick = () => {
            colorOpen = !colorOpen;
            palette.style.display = colorOpen ? 'grid' : 'none';
            document.getElementById('hm-color-arrow').innerText = colorOpen ? '▲' : '▼';
            const v = document.getElementById('hm-view-settings');
            const scrollContent = v.querySelector('.hm-settings-scroll');
            const header = v.querySelector('.hm-drag-zone');
            let tH = Math.min((header?header.offsetHeight+40:80)+(scrollContent?scrollContent.scrollHeight:0), window.innerHeight*0.85);
            smartUpdateWidgetPos(tH, 380);
        };

        palette.querySelectorAll('.hm-palette-item').forEach(el => {
            el.onmouseenter = () => el.style.transform = 'scale(1.15)';
            el.onmouseleave = () => el.style.transform = 'scale(1)';
            el.onclick = (e) => {
                selAcc = e.target.dataset.color;
                document.getElementById('hm-color-swatch').style.background = selAcc;
                document.getElementById('hm-color-text').innerText = selAcc;
                document.getElementById('hm-color-custom-input').value = selAcc;
                e.stopPropagation();
            };
        });
        document.getElementById('hm-color-custom-input').addEventListener('input', e => {
            let val = e.target.value.trim();
            if (val.charAt(0) !== '#') val = '#' + val;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                selAcc = val;
                document.getElementById('hm-color-swatch').style.background = val;
                document.getElementById('hm-color-text').innerText = val;
            }
        });

        let selDarkMode = prefs.darkMode;
        document.querySelectorAll('#dark-mode-segment .hm-segment-btn').forEach(btn => { if (btn.dataset.value === selDarkMode) btn.classList.add('active'); btn.addEventListener('click', () => { document.querySelectorAll('#dark-mode-segment .hm-segment-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); selDarkMode = btn.dataset.value; }); });

        document.getElementById('s-export').onclick = () => {
            const data = { config: GM_getValue('yu_config'), prefs: GM_getValue('hm_ui_prefs'), db: GM_getValue('zhi_jing_oi_data') };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `ZhiJingOI_Backup_${new Date().getTime()}.json`; a.click(); URL.revokeObjectURL(url);
        };
        document.getElementById('s-import').onclick = () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
            input.onchange = e => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                    try { const data = JSON.parse(ev.target.result); if (data.config) GM_setValue('yu_config', data.config); if (data.prefs) GM_setValue('hm_ui_prefs', data.prefs); if (data.db) GM_setValue('zhi_jing_oi_data', data.db); alert('导入成功！正在为您重新加载...'); location.reload(); } catch(err) { alert('解析失败，请确保导入的是正确的备份文件。'); }
                }; reader.readAsText(file);
            }; input.click();
        };

        document.getElementById('s-back').onclick = () => transitionTo('main');
        document.getElementById('s-save').onclick = () => {
            GM_setValue('yu_config', {
                ...c, name: document.getElementById('s-name').value.trim() || 'OIer', d: selectedDay, h: curH, m: curM,
                lg: document.getElementById('s-lg').value.trim(), cf: document.getElementById('s-cf').value.trim(), at: document.getElementById('s-at').value.trim(), lc: document.getElementById('s-lc').value.trim(), uva: document.getElementById('s-uva').value.trim(),
                w_en: document.getElementById('set-weight-enable').checked
            });

            GM_setValue(UI_PREFS_KEY, { ...prefs, liquidGlass: document.getElementById('ui-glass').checked, physicsEnabled: document.getElementById('ui-physics').checked, edgeHideEnabled: document.getElementById('ui-edge-hide').checked, icon: document.getElementById('ui-icon').value.trim() || '🎯', hitokotoMode: selectedHitokoto, hitokotoApi: document.querySelector('#hitokoto-preset-segment .hm-segment-btn[data-url="custom"]').classList.contains('active') ? hitoInput.value.trim() : currentHitoUrl, accentColor: selAcc, darkMode: selDarkMode, fontFamily: document.getElementById('ui-font').value.trim(), backgroundImageUrl: document.getElementById('ui-bg').value.trim() });

            currentUIPrefs = loadUIPrefs(); refreshDynamicStyles(); widget.classList.toggle('no-glass', !currentUIPrefs.liquidGlass); updateBallIcon(currentUIPrefs.icon);
            d.weeklyGoal = parseInt(document.getElementById('s-g').value) || 10; d.lastSync = 0; GM_setValue(dbKey, d);
            transitionTo('main'); startIncrementalTrace(dbKey, true); resetEdgeTimer();
        };
    }

    // ===================== 物理引擎与拖拽逻辑 =====================
    let scrollTargetY = 0, scrollCurrentY = 0, scrollAnimFrame = null, lastScrollTime = 0, isDragging = false, springAnimId = null;
    window.addEventListener('wheel', e => { if (!currentUIPrefs.physicsEnabled || currentState !== 'ball' || isDragging) return; scrollTargetY = (e.deltaY > 0 ? 1 : -1) * 15; lastScrollTime = performance.now(); if (!scrollAnimFrame) scrollAnimFrame = requestAnimationFrame(updateScrollSmooth); }, { passive: true });

    function updateScrollSmooth() {
        if (!currentUIPrefs.physicsEnabled) { scrollAnimFrame = null; return; }
        if (performance.now() - lastScrollTime > 100) scrollTargetY = 0; scrollCurrentY += (scrollTargetY - scrollCurrentY) * 0.12;
        if (Math.abs(scrollCurrentY) < 0.1 && scrollTargetY === 0) { scrollCurrentY = 0; widget.style.transform = 'translateY(0)'; scrollAnimFrame = null; return; }
        widget.style.transform = `translateY(${scrollCurrentY}px)`; scrollAnimFrame = requestAnimationFrame(updateScrollSmooth);
    }

    function startSpringBack(sL, sT) {
        if (springAnimId) cancelAnimationFrame(springAnimId); if (scrollAnimFrame) { cancelAnimationFrame(scrollAnimFrame); scrollAnimFrame = null; scrollTargetY = 0; scrollCurrentY = 0; widget.style.transform = 'translateY(0)'; }
        const minX = 20, minY = 20, maxX = window.innerWidth - widget.offsetWidth - 20, maxY = window.innerHeight - widget.offsetHeight - 20;
        let target = currentUIPrefs.constrainToScreen ? { left: Math.max(minX, Math.min(maxX, sL)), top: Math.max(minY, Math.min(maxY, sT)) } : { left: sL, top: sT };
        if (!currentUIPrefs.physicsEnabled) { widget.style.left = target.left + 'px'; widget.style.top = target.top + 'px'; isDragging = false; return; }

        let cL = sL, cT = sT, vx = 0, vy = 0; widget.style.transition = 'none';
        function step() {
            const dx = target.left - cL, dy = target.top - cT; vx = (vx + dx * 0.22) * 0.75; vy = (vy + dy * 0.22) * 0.75; cL += vx; cT += vy;
            widget.style.left = cL + 'px'; widget.style.top = cT + 'px';
            if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) { widget.style.transition = ''; widget.style.left = target.left + 'px'; widget.style.top = target.top + 'px'; springAnimId = null; isDragging = false; resetEdgeTimer(); return; }
            springAnimId = requestAnimationFrame(step);
        }
        springAnimId = requestAnimationFrame(step);
    }

    widget.addEventListener('mousedown', e => {
        if (currentState !== 'ball' && !e.target.closest('.hm-drag-zone')) return; if (springAnimId) return;
        isDragging = true; edgeOriginalLeft = null; widget.style.transition = 'none';

        let isMoved = false, startX = e.clientX, startY = e.clientY; const rect = widget.getBoundingClientRect(); let iL = rect.left, iT = rect.top;
        if (scrollAnimFrame) { cancelAnimationFrame(scrollAnimFrame); scrollAnimFrame = null; scrollTargetY = 0; scrollCurrentY = 0; widget.style.transform = 'translateY(0)'; }
        const move = ev => { if (Math.abs(ev.clientX-startX)>5 || Math.abs(ev.clientY-startY)>5) isMoved = true; widget.style.left = (iL + ev.clientX - startX) + 'px'; widget.style.top = (iT + ev.clientY - startY) + 'px'; };
        const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); widget.style.transition = ''; if (isMoved) startSpringBack(widget.getBoundingClientRect().left, widget.getBoundingClientRect().top); else { isDragging = false; if (currentState === 'ball') transitionTo('main'); } resetEdgeTimer(); };
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    });

    document.addEventListener('mousedown', e => {
        if (currentState !== 'ball' && !widget.contains(e.target) && !e.target.closest('#hm-welcome-overlay')) {
            transitionTo('ball');
        }
    });

    function showRitual(dbKey) {
        const d = GM_getValue(dbKey), c = getConfig(), stats = evaluateStats(d, c);
        const ov = document.createElement('div'); ov.id = 'hm-welcome-overlay';
        ov.innerHTML = `<div class="hm-orb orb-1"></div><div class="hm-orb orb-2"></div><div class="hm-glass is-panel" style="width:540px;height:340px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center;"><h1 class="hm-text-premium" style="font-size:36px;margin-bottom:15px;">致境·OI 欢迎回来，${c.name||'OIer'}</h1><p style="font-size:18px;color:var(--hm-text-secondary);line-height:1.6;margin-bottom:35px;">本周已为您攻克折算 <span style="color:var(--hm-blue);font-weight:800;font-size:24px;">${c.w_en?stats.score.toFixed(1)+' 分':stats.count+' 题'}</span><br>保持专注，山顶见。</p><button id="close-ritual" class="hm-glass-btn hm-glass-btn-primary" style="width:auto;padding:15px 50px;">开启专注</button></div>`;
        document.body.appendChild(ov); ov.classList.add('show');
        document.getElementById('close-ritual').onclick = () => { ov.remove(); widget.style.opacity='1'; widget.style.pointerEvents='auto'; resetEdgeTimer(); };
    }

    // ===================== 系统启动 =====================
    autoDetectAndSave(); let d = GM_getValue(dbKey, null);
    if (!d || Date.now() >= (d.nextResetTime || 0)) { archiveWeeklyData(); d = { weeklyGoal:10, nextResetTime: getBoundaries().next, lastSync:0, weeklySolvedPids:[], cfWeeklySolvedPids:[], atWeeklySolvedPids:[], lcWeeklySolvedPids:[], uvaWeeklySolvedPids:[], dailyRecords:{} }; GM_setValue(dbKey, d); }
    if (Date.now() - (d.lastSync || 0) > AUTO_CHECK_LIMIT) startIncrementalTrace(dbKey, true);

    const nowPeriod = Math.floor(Date.now() / (1000*60*60*6));
    if (GM_getValue('last_greet_global',0) !== nowPeriod) { showRitual(dbKey); GM_setValue('last_greet_global', nowPeriod); }
    else { widget.style.opacity='1'; widget.style.pointerEvents='auto'; renderMainView(dbKey); resetEdgeTimer(); }
})();
