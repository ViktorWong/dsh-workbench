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
		var PLUGIN_VERSION = "0.6.1";

		// Service keys (same semantics as host-side cordis inject), as a
		// STATIC ARRAY — the web loader reads it before the fiber runs.
		var inject = ["connection"];

		// Self-contained palette — NEVER read DSH theme vars: the host page may
		// be in light mode where its label colors are dark-on-dark for us.
		// (CSS custom props on :root cascade into fixed-position elements.)
		var STYLE = [
			".dshwb-root{position:fixed;right:18px;bottom:18px;z-index:2147483000;font-family:'Inter','PingFang SC',system-ui,sans-serif;font-size:13px;color:#eceaf4;-webkit-font-smoothing:antialiased;}",
			".dshwb-pill{display:flex;align-items:center;gap:9px;padding:9px 16px;border-radius:999px;border:1px solid rgba(167,139,250,.28);background:linear-gradient(160deg,#221c4e,#141126 70%);backdrop-filter:blur(12px);cursor:pointer;box-shadow:0 6px 28px rgba(0,0,0,.45),0 0 20px rgba(130,87,255,.22);user-select:none;transition:border-color .15s,transform .15s;}",
			".dshwb-pill:hover{border-color:rgba(167,139,250,.6);transform:translateY(-1px);}",
			".dshwb-dot{width:8px;height:8px;border-radius:50%;background:linear-gradient(96deg,#a78bfa,#22d3ee);box-shadow:0 0 8px rgba(130,87,255,.8);flex:none;}",
			".dshwb-pill b{font-weight:700;font-variant-numeric:tabular-nums;color:#fff;}",
			".dshwb-pill .muted{color:#9b96b8;}",
			".dshwb-card{width:352px;max-height:72vh;overflow:auto;border-radius:18px;border:1px solid rgba(255,255,255,.11);background:linear-gradient(175deg,#191531,#100d20 60%,#0d0b1a);backdrop-filter:blur(16px);box-shadow:0 18px 60px rgba(0,0,0,.55),0 0 40px rgba(130,87,255,.14);}",
			".dshwb-head{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.09);position:sticky;top:0;background:linear-gradient(175deg,#191531,#131026);z-index:2;}",
			".dshwb-title{display:flex;align-items:center;gap:9px;font-weight:700;font-size:14px;letter-spacing:.2px;color:#fff;}",
			".dshwb-title .sub{font-weight:500;font-size:10px;color:#8f8ab0;margin-left:2px;letter-spacing:.4px;}",
			".dshwb-actions{display:flex;gap:6px;}",
			".dshwb-btn{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#dcd8ee;border-radius:8px;padding:4px 10px;font-size:11.5px;cursor:pointer;line-height:1.5;transition:border-color .15s,background .15s;}",
			".dshwb-btn:hover{border-color:rgba(167,139,250,.6);background:rgba(130,87,255,.12);}",
			".dshwb-body{padding:14px 16px;}",
			".dshwb-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px;}",
			".dshwb-cell{border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:9px 11px;background:rgba(255,255,255,.025);}",
			".dshwb-cell .l{color:#8f8ab0;font-size:10.5px;letter-spacing:.3px;margin-bottom:3px;}",
			".dshwb-cell .v{font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;color:#c4b5fd;text-shadow:0 0 14px rgba(139,92,246,.35);}",
			".dshwb-sec{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;color:#a09bc2;margin:6px 0 9px;letter-spacing:.5px;text-transform:uppercase;}",
			".dshwb-sec::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.08);}",
			".dshwb-chartwrap{border:1px solid rgba(255,255,255,.07);border-radius:11px;padding:12px 12px 8px;background:rgba(255,255,255,.02);margin-bottom:14px;}",
			".dshwb-chart{display:flex;align-items:flex-end;gap:4px;height:72px;}",
			".dshwb-bar{flex:1;min-width:0;border-radius:4px 4px 2px 2px;background:linear-gradient(180deg,#a78bfa 0%,#8257ff 55%,#3b82f6 100%);opacity:.9;transition:opacity .15s;cursor:default;}",
			".dshwb-bar:hover{opacity:1;box-shadow:0 0 10px rgba(130,87,255,.6);}",
			".dshwb-bar.empty{background:rgba(255,255,255,.1);opacity:1;min-height:2px;height:2px!important;box-shadow:none;}",
			".dshwb-xlabels{display:flex;gap:4px;margin-top:5px;}",
			".dshwb-xlabels span{flex:1;text-align:center;font-size:8.5px;color:#6d688d;overflow:hidden;white-space:nowrap;}",
			".dshwb-rows{width:100%;border-collapse:collapse;font-size:12px;}",
			".dshwb-rows th{text-align:left;font-weight:500;color:#8f8ab0;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.09);font-size:11px;}",
			".dshwb-rows td{padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.05);font-variant-numeric:tabular-nums;color:#dcd8ee;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
			".dshwb-rows tr:last-child td{border-bottom:none;}",
			".dshwb-empty{color:#8f8ab0;font-size:12px;padding:10px 0;}",
			".dshwb-err{color:#fb7185;font-size:12px;padding:10px 0;}",
			".dshwb-foot{padding:9px 16px;border-top:1px solid rgba(255,255,255,.09);color:#6d688d;font-size:10px;display:flex;justify-content:space-between;}",
			".dshwb-runtime{margin-bottom:13px;padding:7px 11px;border:1px solid rgba(167,139,250,.3);border-radius:10px;background:rgba(130,87,255,.09);font-size:11.5px;color:#c4b5fd;font-variant-numeric:tabular-nums;}",
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
			series.forEach(function (d, idx) {
				var total = d.i + d.o + d.cr + d.cw;
				var h = total > 0 ? Math.max(8, Math.round((total / max) * 100)) : 0;
				var title = d.date + " · 输入 " + fmtTokens(d.i) + " · 输出 " + fmtTokens(d.o) + " · 缓存 " + fmtTokens(d.cr + d.cw);
				bars.appendChild(el("div", {
					class: total > 0 ? "dshwb-bar" : "dshwb-bar empty",
					title: title,
					style: total > 0 ? { height: h + "%" } : {},
				}));
				// Sparse labels: first, last, and every 3rd day in between.
				var show = idx === 0 || idx === series.length - 1 || idx % 3 === 1;
				labels.appendChild(el("span", { text: show ? d.date.slice(5) : "" }));
			});
			return el("div", { class: "dshwb-chartwrap" }, [bars, labels]);
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
					if (state.runtime && (state.runtime.current || state.runtime.state === "checking")) {
						var badge = { updated: "✓ 已升级", checking: "…检查更新", "skipped-major": "⚠ 新大版本待手动升级", error: "✗ 升级失败", idle: "", reset: "", unknown: "" }[state.runtime.state] || "";
						runtimeLine = el("div", { class: "dshwb-runtime" }, [
							state.runtime.current ? el("b", { text: "runtime v" + state.runtime.current }) : null,
							badge ? el("span", { text: "  " + badge }) : null,
						]);
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
						el("div", { class: "dshwb-title" }, [
							el("span", { class: "dshwb-dot" }),
							"Workbench",
							el("span", { class: "sub", text: "v" + PLUGIN_VERSION }),
						]),
						el("div", { class: "dshwb-actions" }, [
							el("button", { class: "dshwb-btn", text: "刷新", onclick: refresh }),
							el("button", { class: "dshwb-btn", text: "收起", onclick: toggle }),
						]),
					]),
					el("div", { class: "dshwb-body" }, [body]),
					el("div", { class: "dshwb-foot" }, [
						el("span", { text: "全日志投影口径 · 压缩与分页不影响数字" }),
						el("span", { text: "60s 自动刷新" }),
					]),
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
