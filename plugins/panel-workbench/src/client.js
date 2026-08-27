// Web client side of the workbench panel plugin — v1.0 "Session Console".
//
// This file IS the shipped bundle format: the DSH web shell installs
// window.__ModuleLoader__ before any plugin script runs, and executing this
// script registers our factory. The panel is plain DOM (no React dependency).
//
// Data sources:
//   api.sessions.list()     — session cards + fork lineage + workspace grouping
//   api.workspaces.list()   — workspace titles for grouping
//   /api/workbench/*        — host plugin routes (usage, activity, runtime)
window.__ModuleLoader__.load({
	id: "@dsh-workbench/panel-workbench",
	factory: (_require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var PLUGIN_VERSION = "1.2.0";

		// Only inject "connection": the session/workspace data comes through
		// the connection service's RPC face (ctx.get("connection").api.sessions
		// / .workspaces), not through separate cordis services. Injecting
		// "sessions"/"workspaces" caused the fiber to wait for services whose
		// availability ordering left .api uninitialized (race → undefined.list).
		var inject = ["connection"];

		var C = {
			text: "#eceaf4", dim: "#9b96b8", faint: "#6d688d",
			violet: "#a78bfa", valueColor: "#c4b5fd",
			green: "#34d399", amber: "#fbbf24", pink: "#ff5e8a",
			border: "rgba(255,255,255,.09)", borderActive: "rgba(130,87,255,.45)",
		};

		var STYLE = [
			".dshwb-root{position:fixed;right:18px;bottom:18px;z-index:2147483000;font-family:'Inter','PingFang SC',system-ui,sans-serif;font-size:13px;color:" + C.text + ";-webkit-font-smoothing:antialiased;}",
			".dshwb-pill{display:flex;align-items:center;gap:9px;padding:9px 16px;border-radius:999px;border:1px solid rgba(167,139,250,.28);background:linear-gradient(160deg,#221c4e,#141126 70%);backdrop-filter:blur(12px);cursor:pointer;box-shadow:0 6px 28px rgba(0,0,0,.45),0 0 20px rgba(130,87,255,.22);user-select:none;transition:border-color .15s,transform .15s;}",
			".dshwb-pill:hover{border-color:rgba(167,139,250,.6);transform:translateY(-1px);}",
			".dshwb-dot{width:8px;height:8px;border-radius:50%;background:linear-gradient(96deg,#a78bfa,#22d3ee);box-shadow:0 0 8px rgba(130,87,255,.8);flex:none;}",
			".dshwb-pill b{font-weight:700;font-variant-numeric:tabular-nums;color:#fff;}",
			".dshwb-pill .muted{color:" + C.dim + ";}",
			".dshwb-card{width:560px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column;border-radius:18px;border:1px solid " + C.border + ";background:linear-gradient(175deg,#191531,#100d20 60%,#0d0b1a);backdrop-filter:blur(16px);box-shadow:0 18px 60px rgba(0,0,0,.55),0 0 40px rgba(130,87,255,.14);}",
			".dshwb-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid " + C.border + ";flex:none;}",
			".dshwb-title{display:flex;align-items:center;gap:9px;font-weight:700;font-size:14px;color:#fff;}",
			".dshwb-title .sub{font-weight:500;font-size:10px;color:" + C.faint + ";letter-spacing:.4px;}",
			".dshwb-tabs{display:flex;gap:4px;}",
			".dshwb-tab{padding:5px 12px;border-radius:8px;border:1px solid transparent;background:transparent;color:" + C.dim + ";font-size:12px;cursor:pointer;transition:all .15s;}",
			".dshwb-tab:hover{color:" + C.text + ";background:rgba(255,255,255,.04);}",
			".dshwb-tab.active{color:" + C.violet + ";border-color:rgba(130,87,255,.3);background:rgba(130,87,255,.1);font-weight:600;}",
			".dshwb-actions{display:flex;gap:6px;}",
			".dshwb-btn{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:" + C.text + ";border-radius:8px;padding:4px 10px;font-size:11.5px;cursor:pointer;line-height:1.5;transition:all .15s;}",
			".dshwb-btn:hover{border-color:rgba(167,139,250,.6);background:rgba(130,87,255,.12);}",
			".dshwb-body{flex:1;overflow-y:auto;padding:14px 16px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent;}",
			".dshwb-body::-webkit-scrollbar{width:6px;}",
			".dshwb-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px;}",
			".dshwb-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;}",
			".dshwb-cell{border:1px solid " + C.border + ";border-radius:11px;padding:9px 11px;background:rgba(255,255,255,.02);}",
			".dshwb-cell .l{color:" + C.faint + ";font-size:10px;letter-spacing:.3px;margin-bottom:3px;text-transform:uppercase;}",
			".dshwb-cell .v{font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;color:" + C.valueColor + ";}",
			".dshwb-chartwrap{border:1px solid " + C.border + ";border-radius:11px;padding:12px 12px 8px;background:rgba(255,255,255,.02);margin-bottom:14px;}",
			".dshwb-chart{display:flex;align-items:flex-end;gap:4px;height:64px;}",
			".dshwb-bar{flex:1;min-width:0;border-radius:3px 3px 1px 1px;background:linear-gradient(180deg,#a78bfa,#8257ff 60%,#3b82f6);opacity:.85;transition:opacity .15s;}",
			".dshwb-bar:hover{opacity:1;}",
			".dshwb-bar.empty{background:rgba(255,255,255,.08);opacity:1;min-height:2px;height:2px!important;}",
			".dshwb-xlabels{display:flex;gap:4px;margin-top:5px;}",
			".dshwb-xlabels span{flex:1;text-align:center;font-size:8px;color:" + C.faint + ";overflow:hidden;white-space:nowrap;}",
			".dshwb-wsgroup{margin-bottom:14px;}",
			".dshwb-wstitle{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;color:" + C.dim + ";margin-bottom:8px;letter-spacing:.4px;text-transform:uppercase;}",
			".dshwb-wstitle::after{content:'';flex:1;height:1px;background:" + C.border + ";}",
			".dshwb-wscount{background:rgba(130,87,255,.15);color:" + C.violet + ";border-radius:4px;padding:1px 6px;font-size:10px;}",
			".dshwb-sgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}",
			".dshwb-scard{border:1px solid " + C.border + ";border-radius:12px;padding:11px 13px;background:rgba(255,255,255,.02);cursor:pointer;transition:all .15s;}",
			".dshwb-scard:hover{border-color:" + C.borderActive + ";background:rgba(130,87,255,.06);transform:translateY(-1px);}",
			".dshwb-scard .row1{display:flex;align-items:center;gap:7px;margin-bottom:6px;}",
			".dshwb-scard .ttl{font-weight:600;font-size:13px;color:#fff;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
			".dshwb-scard .sub{font-size:11px;color:" + C.dim + ";display:flex;gap:10px;}",
			".dshwb-badge{width:8px;height:8px;border-radius:50%;flex:none;}",
			".dshwb-badge.run{background:" + C.green + ";box-shadow:0 0 6px rgba(52,211,153,.6);}",
			".dshwb-badge.idle{background:rgba(255,255,255,.2);}",
			".dshwb-badge.sub{background:" + C.amber + ";box-shadow:0 0 6px rgba(251,191,36,.5);}",
			".dshwb-forktag{font-size:9px;color:" + C.violet + ";border:1px solid rgba(130,87,255,.3);border-radius:4px;padding:1px 5px;flex:none;}",
			".dshwb-timeline{display:flex;flex-direction:column;gap:2px;}",
			".dshwb-tev{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:8px;transition:background .1s;}",
			".dshwb-tev:hover{background:rgba(255,255,255,.03);}",
			".dshwb-tev .time{font-size:10px;color:" + C.faint + ";font-variant-numeric:tabular-nums;flex:none;width:52px;}",
			".dshwb-tev .icon{flex:none;font-size:13px;width:18px;text-align:center;}",
			".dshwb-tev .desc{flex:1;font-size:12px;color:" + C.text + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
			".dshwb-tev .dur{font-size:10px;color:" + C.faint + ";font-variant-numeric:tabular-nums;flex:none;}",
			".dshwb-tev.approval .desc{color:" + C.amber + ";}",
			".dshwb-tev.err .desc{color:" + C.pink + ";}",
			".dshwb-empty{color:" + C.faint + ";font-size:12px;padding:20px 0;text-align:center;}",
			".dshwb-err{color:" + C.pink + ";font-size:12px;padding:10px 0;}",
			// Subagent model config styles
		".dshwb-samodel{margin-bottom:14px;padding:11px 13px;border:1px solid " + C.border + ";border-radius:12px;background:rgba(255,255,255,.02);}",
		".dshwb-samodel .hdr{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:11px;font-weight:600;color:" + C.dim + ";text-transform:uppercase;letter-spacing:.4px;}",
		".dshwb-samodel .hint{font-size:10.5px;color:" + C.faint + ";margin-bottom:8px;}",
		".dshwb-samodel .row{display:flex;gap:8px;align-items:center;}",
		".dshwb-select{flex:1;padding:6px 10px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:rgba(15,14,23,.8);color:" + C.text + ";font-size:12px;font-family:inherit;outline:none;cursor:pointer;}",
		".dshwb-select:focus{border-color:rgba(167,139,250,.5);}",
		".dshwb-select option{background:#14121f;color:" + C.text + ";}",
		".dshwb-samodel .cur{font-size:11px;color:" + C.valueColor + ";font-variant-numeric:tabular-nums;}",
		".dshwb-restart{margin-top:8px;padding:6px 10px;border:1px solid rgba(251,191,36,.3);border-radius:8px;background:rgba(251,191,36,.08);font-size:11px;color:" + C.amber + ";display:none;}",
		".dshwb-restart.show{display:block;}",

		// Search bar
		".dshwb-search{width:100%;padding:8px 12px;border:1px solid " + C.border + ";border-radius:10px;background:rgba(255,255,255,.03);color:" + C.text + ";font-size:12px;font-family:inherit;outline:none;margin-bottom:10px;transition:border-color .15s;}",
		".dshwb-search:focus{border-color:rgba(167,139,250,.4);}",
		".dshwb-search::placeholder{color:" + C.faint + ";}",

		// Approval toast
		".dshwb-toast{position:fixed;top:18px;right:18px;z-index:2147483600;padding:12px 16px;border-radius:12px;border:1px solid rgba(251,191,36,.4);background:linear-gradient(160deg,#2d2210,#1a1508);backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,.5),0 0 20px rgba(251,191,36,.15);font-family:'Inter','PingFang SC',system-ui,sans-serif;font-size:13px;color:#fbbf24;cursor:pointer;animation:dshwb-slidein .25s ease-out;max-width:340px;}",
		".dshwb-toast .t{font-weight:600;margin-bottom:4px;}",
		".dshwb-toast .d{font-size:11.5px;color:#d4b896;}",
		"@keyframes dshwb-slidein{from{transform:translateX(100%);opacity:0;}to{transform:translateX(0);opacity:1;}}",

		// Drag handle
		".dshwb-drag{cursor:grab;user-select:none;}",
		".dshwb-drag:active{cursor:grabbing;}",

		".dshwb-foot{padding:8px 16px;border-top:1px solid " + C.border + ";color:" + C.faint + ";font-size:10px;display:flex;justify-content:space-between;flex:none;}",
			".dshwb-runtime{margin-bottom:12px;padding:7px 11px;border:1px solid rgba(167,139,250,.3);border-radius:10px;background:rgba(130,87,255,.08);font-size:11.5px;color:" + C.valueColor + ";font-variant-numeric:tabular-nums;}",
			".dshwb-runtime b{color:#fff;font-weight:600;}",
		].join("\n");

		function fmtTokens(n) {
			if (n === undefined || n === null) return "—";
			if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
			if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
			return String(n);
		}
		function fmtDuration(ms) {
			if (!ms) return "—";
			if (ms >= 3_600_000) return (ms / 3_600_000).toFixed(1) + "h";
			if (ms >= 60_000) return Math.round(ms / 60_000) + "m";
			if (ms >= 1000) return Math.round(ms / 1000) + "s";
			return ms + "ms";
		}
		function fmtTime(ts) {
			var d = new Date(ts);
			return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
		}
		function el(tag, attrs, children) {
			var node = document.createElement(tag);
			if (attrs) {
				for (var k in attrs) {
					if (k === "text") node.textContent = attrs[k];
					else if (k === "style" && typeof attrs[k] === "object") Object.assign(node.style, attrs[k]);
					else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
					else node.setAttribute(k, attrs[k]);
				}
			}
			(children ? (Array.isArray(children) ? children : [children]) : []).forEach(function (c) {
				if (c === null || c === undefined) return;
				node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
			});
			return node;
		}

		function aggregate(items) {
			var t = { sessions: 0, active: 0, turns: 0, steps: 0, llmMs: 0, toolMs: 0, input: 0, output: 0 };
			for (var item of items) {
				if (item.blank) continue;
				t.sessions += 1;
				if (item.running) t.active += 1;
				var v = item.projections && item.projections.values;
				if (!v) continue;
				var s = v.sessionStats;
				if (s) { t.turns += s.turns || 0; t.steps += s.steps || 0; t.llmMs += s.llmMs || 0; t.toolMs += s.toolMs || 0; }
				var u = v.tokenUsage;
				if (u) { t.input += u.uncachedInputTokens || 0; t.output += u.outputTokens || 0; }
			}
			return t;
		}

		function buildSessionCards(items, workspaces) {
			var wsBySession = {};
			if (workspaces) {
				for (var ws of workspaces) {
					for (var sid of ws.sessionIds || []) wsBySession[sid] = ws;
				}
			}
			var cards = [];
			for (var item of items) {
				if (item.blank) continue;
				var v = (item.projections || {}).values || {};
				var stats = v.sessionStats || {};
				var usage = v.tokenUsage || {};
				var wsInfo = wsBySession[item.sessionId];
				cards.push({
					id: item.sessionId,
					title: v.title || "新会话",
					running: item.running,
					isSubagent: item.origin === "subagent",
					parentId: item.parentSessionId,
					turns: stats.turns || 0,
					tokens: (usage.uncachedInputTokens || 0) + (usage.outputTokens || 0) + (usage.cacheReadTokens || 0) + (usage.cacheWriteTokens || 0),
					workspace: wsInfo ? wsInfo.title : "未分组",
					workspaceId: wsInfo ? wsInfo.id : null,
				});
			}
			return cards;
		}

		async function fetchAll(api) {
			var sessionsRes = await api.sessions.list({});
			var sessions = sessionsRes.result.ok ? sessionsRes.result.value.items : [];
			var wsRes = await api.workspaces.list({});
			var workspaces = wsRes.result.ok ? wsRes.result.value.items : [];
			return { sessions, workspaces };
		}
		async function fetchDaily() {
			var res = await fetch("/api/workbench/usage-daily", { headers: { accept: "application/json" } });
			if (!res.ok) throw new Error("usage-daily " + res.status);
			return await res.json();
		}
		async function fetchActivity() {
			var res = await fetch("/api/workbench/activity", { headers: { accept: "application/json" } });
			if (!res.ok) throw new Error("activity " + res.status);
			return await res.json();
		}
		async function fetchRuntimeStatus() {
			var res = await fetch("/api/workbench/runtime-status", { headers: { accept: "application/json" } });
			return res.ok ? await res.json() : null;
		}
		async function fetchSubagentModel() {
			var res = await fetch("/api/workbench/subagent-model", { headers: { accept: "application/json" } });
			return res.ok ? await res.json() : null;
		}
		async function setSubagentModel(provider, model) {
			var res = await fetch("/api/workbench/subagent-model", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(provider && model ? { provider: provider, model: model } : { clear: true }),
			});
			return res.ok ? await res.json() : null;
		}

		function chartNode(series) {
			var max = 1;
			series.forEach(function (d) { max = Math.max(max, d.i + d.o + d.cr + d.cw); });
			var bars = el("div", { class: "dshwb-chart" });
			var labels = el("div", { class: "dshwb-xlabels" });
			series.forEach(function (d, idx) {
				var total = d.i + d.o + d.cr + d.cw;
				var h = total > 0 ? Math.max(8, Math.round((total / max) * 100)) : 0;
				bars.appendChild(el("div", { class: total > 0 ? "dshwb-bar" : "dshwb-bar empty", title: d.date, style: total > 0 ? { height: h + "%" } : {} }));
				var show = idx === 0 || idx === series.length - 1 || idx % 3 === 1;
				labels.appendChild(el("span", { text: show ? d.date.slice(5) : "" }));
			});
			return el("div", { class: "dshwb-chartwrap" }, [bars, labels]);
		}

		function sessionCardNode(card, onOpen) {
			var badge = card.running ? "run" : card.isSubagent ? "sub" : "idle";
			return el("div", { class: "dshwb-scard", onclick: function () { onOpen(card); } }, [
				el("div", { class: "row1" }, [
					el("span", { class: "dshwb-badge " + badge }),
					el("span", { class: "ttl", text: card.title }),
					card.parentId ? el("span", { class: "dshwb-forktag", text: card.isSubagent ? "sub" : "fork" }) : null,
				]),
				el("div", { class: "sub" }, [
					el("span", { text: card.turns + " 轮" }),
					el("span", { text: fmtTokens(card.tokens) + " tok" }),
					el("span", { text: card.workspace }),
				]),
			]);
		}

		function renderSessionsTab(cards, onOpen) {
			var groups = {};
			var ungrouped = [];
			for (var card of cards) {
				if (card.workspaceId) (groups[card.workspace] = groups[card.workspace] || []).push(card);
				else ungrouped.push(card);
			}
			var frag = document.createDocumentFragment();
			var wsNames = Object.keys(groups).sort();
			for (var _ws of wsNames) {
				(function (wsName) {
					var cards2 = groups[wsName];
					frag.appendChild(el("div", { class: "dshwb-wsgroup" }, [
						el("div", { class: "dshwb-wstitle" }, [
							wsName,
							el("span", { class: "dshwb-wscount", text: String(cards2.length) }),
						]),
						el("div", { class: "dshwb-sgrid" }, cards2.map(function (c) { return sessionCardNode(c, onOpen); })),
					]));
				})(_ws);
			}
			if (ungrouped.length > 0) {
				frag.appendChild(el("div", { class: "dshwb-wsgroup" }, [
					el("div", { class: "dshwb-wstitle" }, ["未分组", el("span", { class: "dshwb-wscount", text: String(ungrouped.length) })]),
					el("div", { class: "dshwb-sgrid" }, ungrouped.map(function (c) { return sessionCardNode(c, onOpen); })),
				]));
			}
			if (!frag.childNodes.length) return el("div", { class: "dshwb-empty", text: "暂无会话" });
			return frag;
		}

		function renderActivityTab(activityData) {
			if (!activityData || !activityData.events || activityData.events.length === 0) {
				return el("div", { class: "dshwb-empty", text: "暂无活动记录（开始对话后产生）" });
			}
			var icons = { tool: "🔧", approval: "⚠️", session: "▶️", file: "📝" };
			return el("div", { class: "dshwb-timeline" }, activityData.events.map(function (ev) {
				var cls = "dshwb-tev";
				if (ev.kind === "approval") cls += " approval";
				if (ev.ok === false) cls += " err";
				return el("div", { class: cls }, [
					el("span", { class: "time", text: fmtTime(ev.ts) }),
					el("span", { class: "icon", text: icons[ev.kind] || "•" }),
					el("span", { class: "desc", text: ev.label }),
					ev.ms !== undefined ? el("span", { class: "dur", text: fmtDuration(ev.ms) }) : null,
					ev.ok === false ? el("span", { class: "dur", text: "✗", style: { color: C.pink } }) : null,
				]);
			}));
		}

		function renderSubagentModelSection(currentModel, availableModels, onChange) {
			var select = el("select", { class: "dshwb-select" })
			// Default option: inherit parent
			select.appendChild(el("option", { value: "", text: "继承父会话模型（默认）" }))
			if (availableModels) {
				for (var group of availableModels) {
					var og = el("optgroup", { label: group.name || group.id })
					for (var m of group.models || []) {
						var val = group.id + "/" + m.id
						var opt = el("option", { value: val, text: m.name || m.id })
						if (currentModel && currentModel.provider === group.id && currentModel.model === m.id) {
							opt.selected = true
						}
						og.appendChild(opt)
					}
					select.appendChild(og)
				}
			}
			select.addEventListener("change", function () {
				var v = select.value
				if (!v) onChange(null, null)
				else {
					var parts = v.split("/")
					onChange(parts[0], parts.slice(1).join("/"))
				}
			})
			return el("div", { class: "dshwb-samodel" }, [
				el("div", { class: "hdr" }, ["🤖 Subagent 模型"]),
				el("div", { class: "hint", text: "指定子代理使用的模型（不影响主会话）。更改后需重启应用生效。" }),
				el("div", { class: "row" }, [select]),
				currentModel ? el("div", { class: "cur", text: "当前：" + currentModel.provider + " / " + currentModel.model }) : null,
			])
		}

			function renderStatsTab(data, daily, subagentModel, availableModels, onModelChange) {
				var t = data.totals;
				return el("div", null, [
					el("div", { class: "dshwb-grid" }, [
						el("div", { class: "dshwb-cell" }, [el("div", { class: "l", text: "会话 / 进行中" }), el("div", { class: "v", text: t.sessions + " / " + t.active })]),
						el("div", { class: "dshwb-cell" }, [el("div", { class: "l", text: "轮次 / 步骤" }), el("div", { class: "v", text: t.turns + " / " + t.steps })]),
						el("div", { class: "dshwb-cell" }, [el("div", { class: "l", text: "输入 tokens" }), el("div", { class: "v", text: fmtTokens(t.input) })]),
						el("div", { class: "dshwb-cell" }, [el("div", { class: "l", text: "输出 tokens" }), el("div", { class: "v", text: fmtTokens(t.output) })]),
						el("div", { class: "dshwb-cell" }, [el("div", { class: "l", text: "模型时间" }), el("div", { class: "v", text: fmtDuration(t.llmMs) })]),
						el("div", { class: "dshwb-cell" }, [el("div", { class: "l", text: "工具时间" }), el("div", { class: "v", text: fmtDuration(t.toolMs) })]),
					]),
					daily ? chartNode(daily.series) : el("div", { class: "dshwb-empty", text: "趋势加载中…" }),
					renderSubagentModelSection(subagentModel, availableModels, onModelChange),
				]);
			}

		function createPanel(ctx) {
			var styleEl = el("style", { "data-plugin": "@dsh-workbench/panel-workbench" });
			styleEl.textContent = STYLE;
			document.head.appendChild(styleEl);

			var state = {
				expanded: localStorage.getItem("dshwb.expanded") === "1",
				tab: localStorage.getItem("dshwb.tab") || "sessions",
				data: null, daily: null, activity: null, runtime: null,
				subagentModel: null, availableModels: null,
				error: null, cards: [],
				searchQuery: "",
			};
			var api = null;
			var timer = null;
			var activityTimer = null;
			var lastApprovalTs = 0;

			var root = el("div", { class: "dshwb-root" });
			// Restore drag position
			try {
				var pos = JSON.parse(localStorage.getItem("dshwb.pos") || "null");
				if (pos) {
					root.style.right = "auto";
					root.style.bottom = "auto";
					root.style.left = pos.x + "px";
					root.style.top = pos.y + "px";
				}
			} catch { /* position restore is best-effort */ }
			document.body.appendChild(root);

			// Drag support on the pill/card header
			function makeDraggable(handle) {
				var isDragging = false;
				var startX = 0, startY = 0, startLeft = 0, startTop = 0;
				handle.classList.add("dshwb-drag");
				handle.addEventListener("mousedown", function (e) {
					if (e.target.tagName === "BUTTON" || e.target.tagName === "SELECT") return;
					isDragging = true;
					var rect = root.getBoundingClientRect();
					startLeft = rect.left;
					startTop = rect.top;
					startX = e.clientX;
					startY = e.clientY;
					root.style.right = "auto";
					root.style.bottom = "auto";
					e.preventDefault();
				});
				document.addEventListener("mousemove", function (e) {
					if (!isDragging) return;
					var x = Math.max(0, Math.min(window.innerWidth - 100, startLeft + e.clientX - startX));
					var y = Math.max(0, Math.min(window.innerHeight - 50, startTop + e.clientY - startY));
					root.style.left = x + "px";
					root.style.top = y + "px";
				});
				document.addEventListener("mouseup", function () {
					if (!isDragging) return;
					isDragging = false;
					var rect = root.getBoundingClientRect();
					localStorage.setItem("dshwb.pos", JSON.stringify({ x: rect.left, y: rect.top }));
				});
			}

			// Approval toast
			function checkForApprovals() {
				if (!state.activity || !state.activity.events) return;
				for (var ev of state.activity.events) {
					if (ev.kind === "approval" && ev.ts > lastApprovalTs) {
						lastApprovalTs = ev.ts;
						showApprovalToast(ev);
					}
				}
			}
			function showApprovalToast(ev) {
				var existing = document.querySelector(".dshwb-toast");
				if (existing) existing.remove();
				var toast = el("div", {
					class: "dshwb-toast",
					onclick: function () { toast.remove(); },
				}, [
					el("div", { class: "t", text: "⚠️ 等待审批" }),
					el("div", { class: "d", text: ev.label }),
				]);
				document.body.appendChild(toast);
				setTimeout(function () { toast.remove(); }, 10_000);
			}

			function openSession(card) {
				try {
					var sessions = ctx.get("sessions");
					if (sessions && sessions.select) sessions.select(card.id);
				} catch (e) {
					console.warn("[workbench-panel] open session failed:", e);
				}
			}

			function render() {
				root.innerHTML = "";
				if (!state.expanded) {
					var pill = el("div", { class: "dshwb-pill", onclick: toggle }, [
						el("span", { class: "dshwb-dot" }),
						el("span", null, ["Workbench "]),
						state.data ? el("b", { text: String(state.data.totals.sessions) }) : el("span", { class: "muted", text: "…" }),
						el("span", { class: "muted", text: " 会话" }),
						state.data && state.data.totals.active > 0 ? el("span", { class: "muted", text: " · ● " + state.data.totals.active }) : null,
					]);
					root.appendChild(pill);
					makeDraggable(pill);
					return;
				}

				var bodyContent;
				if (state.error) bodyContent = el("div", { class: "dshwb-err", text: "加载失败：" + state.error });
				else if (!state.data) bodyContent = el("div", { class: "dshwb-empty", text: "加载中…" });
				else if (state.tab === "sessions") {
					// Search bar + filtered session cards
					var filtered = state.searchQuery
						? state.cards.filter(function (c) {
								return (
									c.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
									c.workspace.toLowerCase().includes(state.searchQuery.toLowerCase())
								)
							})
						: state.cards;
					bodyContent = el("div", null, [
						el("input", {
							class: "dshwb-search",
							type: "text",
							placeholder: "搜索会话或工作区…",
							value: state.searchQuery,
							oninput: function (e) {
								state.searchQuery = e.target.value;
								render();
							},
						}),
						renderSessionsTab(filtered, openSession),
					]);
				}
				else if (state.tab === "activity") bodyContent = renderActivityTab(state.activity);
				else bodyContent = renderStatsTab(state.data, state.daily, state.subagentModel, state.availableModels, onSubagentModelChange);

				var runtimeLine = null;
				if (state.runtime && state.runtime.current) {
					var badge = { updated: "✓ 已升级", checking: "…", "skipped-major": "⚠ 新大版本", error: "✗ 升级失败", idle: "", reset: "", unknown: "" }[state.runtime.state] || "";
					runtimeLine = el("div", { class: "dshwb-runtime" }, [
						el("b", { text: "runtime v" + state.runtime.current }),
						badge ? el("span", { text: "  " + badge }) : null,
					]);
				}

				var cardEl = el("div", { class: "dshwb-card" }, [
					el("div", { class: "dshwb-head" }, [
						el("div", { class: "dshwb-title" }, [el("span", { class: "dshwb-dot" }), "Workbench", el("span", { class: "sub", text: "v" + PLUGIN_VERSION })]),
						el("div", { class: "dshwb-tabs" }, [
							el("button", { class: "dshwb-tab" + (state.tab === "sessions" ? " active" : ""), text: "会话", onclick: function () { setTab("sessions"); } }),
							el("button", { class: "dshwb-tab" + (state.tab === "activity" ? " active" : ""), text: "活动", onclick: function () { setTab("activity"); } }),
							el("button", { class: "dshwb-tab" + (state.tab === "stats" ? " active" : ""), text: "统计", onclick: function () { setTab("stats"); } }),
						]),
						el("div", { class: "dshwb-actions" }, [
							el("button", { class: "dshwb-btn", text: "刷新", onclick: refresh }),
							el("button", { class: "dshwb-btn", text: "收起", onclick: toggle }),
						]),
					]),
					el("div", { class: "dshwb-body" }, [runtimeLine, bodyContent]),
					el("div", { class: "dshwb-foot" }, [
						el("span", { text: "点击卡片跳转 · 拖拽标题移动" }),
						el("span", { text: "60s 自动刷新" }),
					]),
				]);
				root.appendChild(cardEl);
				var headEl = cardEl.querySelector(".dshwb-head");
				if (headEl) makeDraggable(headEl);
			}

			function setTab(tab) {
				state.tab = tab;
				localStorage.setItem("dshwb.tab", tab);
				render();
				if (tab === "activity") refreshActivity();
			}

			function toggle() {
				state.expanded = !state.expanded;
				localStorage.setItem("dshwb.expanded", state.expanded ? "1" : "0");
				render();
				if (state.expanded) refresh();
			}

			async function onSubagentModelChange(provider, model) {
				try {
					var result = await setSubagentModel(provider, model);
					if (result && result.ok) {
						state.subagentModel = provider && model ? { provider: provider, model: model } : null;
						render();
						// Show a restart notice
						var notice = document.querySelector(".dshwb-restart");
						if (notice) notice.classList.add("show");
					}
				} catch (e) {
					console.warn("[workbench-panel] subagent model change failed:", e);
				}
			}

			async function refresh() {
				if (!api) return;
				try {
					var result = await fetchAll(api);
					state.cards = buildSessionCards(result.sessions, result.workspaces);
					state.data = { totals: aggregate(result.sessions) };
					state.error = null;
				} catch (err) {
					state.error = String((err && err.message) || err);
				}
				try { state.daily = await fetchDaily(); } catch { state.daily = null; }
				try { state.runtime = await fetchRuntimeStatus(); } catch { state.runtime = null; }
				try {
					var sa = await fetchSubagentModel();
					state.subagentModel = sa && sa.current ? sa.current : null;
				} catch { state.subagentModel = null; }
				try {
					// Get available models from the first non-blank session
					if (api && state.cards && state.cards.length > 0) {
						var modelsRes = await api.sessions.models({ sessionId: state.cards[0].id });
						if (modelsRes.result.ok) {
							state.availableModels = modelsRes.result.value.groups;
						}
					}
				} catch { state.availableModels = null; }
				render();
			}

			async function refreshActivity() {
				try { state.activity = await fetchActivity(); } catch { state.activity = null; }
				checkForApprovals();
				if (state.tab === "activity") render();
			}

			api = ctx.get("connection").api;
			render();
			refresh();
			refreshActivity();
			timer = setInterval(refresh, 60_000);
			activityTimer = setInterval(refreshActivity, 10_000);

			return function dispose() {
				if (timer) clearInterval(timer);
				if (activityTimer) clearInterval(activityTimer);
				root.remove();
				styleEl.remove();
			};
		}

		function apply(ctx) {
			var dispose = null;
			var mount = function () {
				if (document.body) {
					dispose = createPanel(ctx);
					console.warn("[workbench-panel] session console mounted v" + PLUGIN_VERSION);
				}
			};
			if (document.body) mount();
			else document.addEventListener("DOMContentLoaded", mount);
			ctx.effect(function () {
				return function () {
					document.removeEventListener("DOMContentLoaded", mount);
					if (dispose) dispose();
				};
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
})
