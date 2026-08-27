// Web client side of the workbench panel plugin.
//
// This file IS the shipped bundle format: the DSH web shell installs
// window.__ModuleLoader__ before any plugin script runs, and executing this
// script registers our factory. The floating panel is plain DOM (no React
// dependency) so it works regardless of what the shell seeds; session stats
// come from the connection RPC face (api.sessions.list), daily usage trends
// from our host plugin's /api/workbench/usage-daily route.
	window.__ModuleLoader__.load({
	id: "@dsh-workbench/panel-workbench",
	// The factory receives the module-graph require; this bundle needs none of
	// it (vanilla DOM), so the parameter is intentionally unused.
	factory: (_require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var PLUGIN_VERSION = "0.6.0";

		// Service keys (same semantics as host-side cordis inject), as a
		// STATIC ARRAY — the web loader reads it before the fiber runs.
		var inject = ["connection"];

		var STYLE = [
			".dshwb-root{position:fixed;right:18px;bottom:18px;z-index:2147483000;font-family:'Inter','PingFang SC',system-ui,sans-serif;font-size:13px;color:var(--dsw-alias-label-primary,#eaeaf0);}",
			".dshwb-pill{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(21,16,51,.88);backdrop-filter:blur(10px);cursor:pointer;box-shadow:0 4px 24px rgba(130,87,255,.25);user-select:none;}",
			".dshwb-pill:hover{border-color:rgba(130,87,255,.55);}",
			".dshwb-dot{width:7px;height:7px;border-radius:50%;background:linear-gradient(96deg,#a78bfa,#22d3ee);}",
			".dshwb-pill b{font-weight:600;font-variant-numeric:tabular-nums;}",
			".dshwb-pill .muted{color:var(--dsw-alias-label-tertiary,#a6a6b5);}",
			".dshwb-card{width:340px;max-height:70vh;overflow:auto;border-radius:16px;border:1px solid rgba(255,255,255,.1);background:rgba(15,14,23,.94);backdrop-filter:blur(14px);box-shadow:0 12px 48px rgba(0,0,0,.5),0 0 32px rgba(130,87,255,.12);}",
			".dshwb-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);position:sticky;top:0;background:inherit;}",
			".dshwb-title{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13.5px;}",
			".dshwb-actions{display:flex;gap:6px;}",
			".dshwb-btn{border:1px solid rgba(255,255,255,.12);background:transparent;color:inherit;border-radius:7px;padding:3px 9px;font-size:11.5px;cursor:pointer;line-height:1.5;}",
			".dshwb-btn:hover{border-color:rgba(130,87,255,.5);}",
			".dshwb-body{padding:12px 14px;}",
			".dshwb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}",
			".dshwb-cell{border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:7px 9px;}",
			".dshwb-cell .l{color:var(--dsw-alias-label-tertiary,#a6a6b5);font-size:11px;}",
			".dshwb-cell .v{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;background:linear-gradient(96deg,#a78bfa,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent;}",
			".dshwb-sec{font-size:11.5px;font-weight:600;color:var(--dsw-alias-label-secondary,#bbb);margin:4px 0 8px;}",
			".dshwb-chart{display:flex;align-items:flex-end;gap:3px;height:64px;margin-bottom:2px;}",
			".dshwb-bar{flex:1;min-width:0;border-radius:3px 3px 0 0;background:linear-gradient(180deg,#8257ff,#22d3ee);opacity:.85;}",
			".dshwb-bar.empty{background:rgba(255,255,255,.08);opacity:1;}",
			".dshwb-xlabels{display:flex;gap:3px;}",
			".dshwb-xlabels span{flex:1;text-align:center;font-size:8.5px;color:var(--dsw-alias-label-tertiary,#888);overflow:hidden;white-space:nowrap;}",
			".dshwb-rows{width:100%;border-collapse:collapse;font-size:12px;}",
			".dshwb-rows th{text-align:left;font-weight:500;color:var(--dsw-alias-label-tertiary,#999);padding:3px 6px;border-bottom:1px solid rgba(255,255,255,.08);}",
			".dshwb-rows td{padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.05);font-variant-numeric:tabular-nums;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
			".dshwb-empty{color:var(--dsw-alias-label-tertiary,#888);font-size:12px;padding:8px 0;}",
			".dshwb-err{color:#ff5e8a;font-size:12px;padding:8px 0;}",
			".dshwb-foot{padding:8px 14px;border-top:1px solid rgba(255,255,255,.08);color:var(--dsw-alias-label-tertiary,#888);font-size:10.5px;}",
			".dshwb-runtime{margin-bottom:10px;padding:6px 10px;border:1px solid rgba(130,87,255,.35);border-radius:8px;background:rgba(130,87,255,.08);font-size:11.5px;color:var(--dsw-alias-label-secondary,#bbb);font-variant-numeric:tabular-nums;}",
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
			return Math.round(ms / 1000) + "s";
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
			var rows = [];
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
				rows.push({
					title: v.title || "（无标题会话）",
					turns: s ? s.turns : undefined,
					tokens: u ? (u.uncachedInputTokens || 0) + (u.outputTokens || 0) + (u.cacheReadTokens || 0) + (u.cacheWriteTokens || 0) : undefined,
					running: item.running,
					updatedAt: item.updatedAt,
				});
			}
			rows.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
			return { totals: t, rows: rows.slice(0, 5) };
		}

		async function fetchSessions(api) {
			var response = await api.sessions.list({});
			var result = response.result;
			if (!result.ok) throw new Error(result.error.message);
			return aggregate(result.value.items);
		}
		async function fetchDaily() {
			var res = await fetch("/api/workbench/usage-daily", { headers: { accept: "application/json" } });
			if (!res.ok) throw new Error("usage-daily " + res.status);
			return await res.json();
		}

		function chartNode(series) {
			var max = 1;
			series.forEach(function (d) { max = Math.max(max, d.i + d.o + d.cr + d.cw); });
			var bars = el("div", { class: "dshwb-chart" });
			var labels = el("div", { class: "dshwb-xlabels" });
			series.forEach(function (d) {
				var total = d.i + d.o + d.cr + d.cw;
				var h = total > 0 ? Math.max(6, Math.round((total / max) * 100)) : 0;
				var title = d.date + " · 输入 " + fmtTokens(d.i) + " · 输出 " + fmtTokens(d.o) + " · 缓存 " + fmtTokens(d.cr + d.cw);
				bars.appendChild(el("div", {
					class: total > 0 ? "dshwb-bar" : "dshwb-bar empty",
					title: title,
					style: { height: h + "%" },
				}));
				labels.appendChild(el("span", { text: d.date.slice(5) }));
			});
			var wrap = el("div", null, [bars, labels]);
			return wrap;
		}

		function createPanel(ctx) {
			var styleEl = el("style", { "data-plugin": "@dsh-workbench/panel-workbench" });
			styleEl.textContent = STYLE;
			document.head.appendChild(styleEl);

			var state = { expanded: localStorage.getItem("dshwb.expanded") === "1", data: null, error: null, daily: null };
			var api = null;
			var timer = null;

			var root = el("div", { class: "dshwb-root" });
			document.body.appendChild(root);

			function render() {
				root.innerHTML = "";
				if (!state.expanded) {
					var pill = el("div", { class: "dshwb-pill", onclick: toggle },
						el("span", { class: "dshwb-dot" }),
						el("span", null, ["Workbench "]),
						state.data
							? el("b", { text: String(state.data.totals.sessions) })
							: el("span", { class: "muted", text: "…" }),
						el("span", { class: "muted", text: " 会话" }),
						state.data && state.data.totals.active > 0
							? el("span", { class: "muted", text: " · ● " + state.data.totals.active })
							: null,
					);
					root.appendChild(pill);
					return;
				}
				var body;
				if (state.error) body = el("div", { class: "dshwb-err", text: "加载失败：" + state.error });
				else if (!state.data) body = el("div", { class: "dshwb-empty", text: "加载中…" });
				else {
					var t = state.data.totals;
					var runtimeLine = null;
					if (state.runtime) {
						var badge = { updated: "✓ 已升级", checking: "…检查更新", "skipped-major": "⚠ 新大版本待手动升级", error: "✗ 升级失败", idle: "", reset: "", unknown: "" }[state.runtime.state] || "";
						var ver = state.runtime.current ? "runtime v" + state.runtime.current : "";
						var parts = [ver, badge].filter(Boolean).join(" · ");
						if (parts) runtimeLine = el("div", { class: "dshwb-runtime", text: parts });
					}
					body = el("div", null, [
						runtimeLine,
						el("div", { class: "dshwb-grid" }, [
							el("div", { class: "dshwb-cell" }, [el("div", { class: "l", text: "会话 / 进行中" }), el("div", { class: "v", text: t.sessions + " / " + t.active })]),
							el("div", { class: "dshwb-cell" }, [el("div", { class: "l", text: "轮次 / 步骤" }), el("div", { class: "v", text: t.turns + " / " + t.steps })]),
							el("div", { class: "dshwb-cell" }, [el("div", { class: "l", text: "输入 tokens" }), el("div", { class: "v", text: fmtTokens(t.input) })]),
							el("div", { class: "dshwb-cell" }, [el("div", { class: "l", text: "输出 tokens" }), el("div", { class: "v", text: fmtTokens(t.output) })]),
							el("div", { class: "dshwb-cell" }, [el("div", { class: "l", text: "模型时间" }), el("div", { class: "v", text: fmtDuration(t.llmMs) })]),
							el("div", { class: "dshwb-cell" }, [el("div", { class: "l", text: "工具时间" }), el("div", { class: "v", text: fmtDuration(t.toolMs) })]),
						]),
						el("div", { class: "dshwb-sec", text: "按天用量（近 14 天）" }),
						state.daily
							? chartNode(state.daily.series)
							: el("div", { class: "dshwb-empty", text: "趋势数据加载中…（自插件安装起统计）" }),
						el("div", { class: "dshwb-sec", text: "最近会话" }),
						el("table", { class: "dshwb-rows" }, [
							el("thead", null, el("tr", null, [
								el("th", { text: "标题" }), el("th", { text: "轮" }), el("th", { text: "tokens" }),
							])),
							el("tbody", null, state.data.rows.map(function (r) {
								return el("tr", null, [
									el("td", { title: r.title, text: (r.running ? "● " : "") + r.title }),
									el("td", { text: r.turns === undefined ? "—" : String(r.turns) }),
									el("td", { text: r.tokens === undefined ? "—" : fmtTokens(r.tokens) }),
								]);
							})),
						]),
					]);
				}
				var card = el("div", { class: "dshwb-card" }, [
					el("div", { class: "dshwb-head" }, [
						el("div", { class: "dshwb-title" }, [el("span", { class: "dshwb-dot" }), "Workbench"]),
						el("div", { class: "dshwb-actions" }, [
							el("button", { class: "dshwb-btn", text: "刷新", onclick: refresh }),
							el("button", { class: "dshwb-btn", text: "收起", onclick: toggle }),
						]),
					]),
					el("div", { class: "dshwb-body" }, [body]),
					el("div", { class: "dshwb-foot", text: "dsh-workbench panel v" + PLUGIN_VERSION + " · 全日志投影口径" }),
				]);
				root.appendChild(card);
			}

			function toggle() {
				state.expanded = !state.expanded;
				localStorage.setItem("dshwb.expanded", state.expanded ? "1" : "0");
				render();
				if (state.expanded) refresh();
			}

			async function refresh() {
				if (!api) return;
				try {
					var data = await fetchSessions(api);
					state.data = data;
					state.error = null;
				} catch (err) {
					state.error = String((err && err.message) || err);
				}
				try {
					state.daily = await fetchDaily();
				} catch {
					state.daily = null;
				}
				try {
					var rt = await fetch("/api/workbench/runtime-status", { headers: { accept: "application/json" } });
					state.runtime = rt.ok ? await rt.json() : null;
				} catch {
					state.runtime = null;
				}
				render();
			}

			api = ctx.get("connection").api;
			render();
			refresh();
			timer = setInterval(refresh, 60_000);

			return function dispose() {
				if (timer) clearInterval(timer);
				root.remove();
				styleEl.remove();
			};
		}

		function apply(ctx) {
			// Mount after the body exists (bundle scripts load in <head> phase
			// of index construction in some deployments).
			var dispose = null;
			var mount = function () {
				if (document.body) {
					dispose = createPanel(ctx);
					console.warn("[workbench-panel] floating panel mounted v" + PLUGIN_VERSION);
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
