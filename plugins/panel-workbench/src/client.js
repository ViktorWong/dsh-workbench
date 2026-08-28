// Web client: Workbench settings section with session console (v1.3).
// Registers a "Workbench" section in the DSH settings page — sessions,
// activity timeline, stats + subagent model picker. React from shell seeds.
window.__ModuleLoader__.load({
	id: "@dsh-workbench/panel-workbench",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var react = require("react");
		var PLUGIN_VERSION = "1.3.0";
		var inject = ["slots", "connection"];

		var C = {
			text: "#eceaf4", dim: "#9b96b8", faint: "#6d688d",
			violet: "#a78bfa", valueColor: "#c4b5fd",
			green: "#34d399", amber: "#fbbf24", pink: "#ff5e8a",
			border: "rgba(255,255,255,.09)", borderActive: "rgba(130,87,255,.45)",
		};

		function fmtTokens(n) {
			if (n === undefined || n === null) return "—";
			if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
			if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
			return String(n);
		}
		function fmtDuration(ms) {
			if (!ms) return "—";
			if (ms >= 36e5) return (ms / 36e5).toFixed(1) + "h";
			if (ms >= 6e4) return Math.round(ms / 6e4) + "m";
			if (ms >= 1e3) return Math.round(ms / 1e3) + "s";
			return ms + "ms";
		}
		function fmtTime(ts) {
			var d = new Date(ts);
			return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
		}

		async function fetchAllData(api) {
			var sr = await api.sessions.list({});
			var sessions = sr.result.ok ? sr.result.value.items : [];
			var wr = await api.workspace.list({});
			var workspaces = wr.result.ok ? wr.result.value.items : [];
			return { sessions: sessions, workspaces: workspaces };
		}
		async function fetchDaily() {
			var r = await fetch("/api/workbench/usage-daily", { headers: { accept: "application/json" } });
			return r.ok ? await r.json() : null;
		}
		async function fetchActivity() {
			var r = await fetch("/api/workbench/activity", { headers: { accept: "application/json" } });
			return r.ok ? await r.json() : null;
		}
		async function fetchRuntime() {
			var r = await fetch("/api/workbench/runtime-status", { headers: { accept: "application/json" } });
			return r.ok ? await r.json() : null;
		}
		async function fetchSaModel() {
			var r = await fetch("/api/workbench/subagent-model", { headers: { accept: "application/json" } });
			return r.ok ? await r.json() : null;
		}
		async function postSaModel(provider, model) {
			var r = await fetch("/api/workbench/subagent-model", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(provider && model ? { provider: provider, model: model } : { clear: true }),
			});
			return r.ok ? await r.json() : null;
		}

		function aggregate(items) {
			var t = { sessions: 0, active: 0, turns: 0, steps: 0, llmMs: 0, toolMs: 0, input: 0, output: 0 };
			for (var item of items) {
				if (item.blank) continue;
				t.sessions++; if (item.running) t.active++;
				var v = item.projections && item.projections.values; if (!v) continue;
				var s = v.sessionStats;
				if (s) { t.turns += s.turns || 0; t.steps += s.steps || 0; t.llmMs += s.llmMs || 0; t.toolMs += s.toolMs || 0; }
				var u = v.tokenUsage;
				if (u) { t.input += u.uncachedInputTokens || 0; t.output += u.outputTokens || 0; }
			}
			return t;
		}
		function buildCards(items, workspaces) {
			var wsMap = {};
			if (workspaces) for (var w of workspaces) for (var sid of w.sessionIds || []) wsMap[sid] = w;
			var cards = [];
			for (var item of items) {
				if (item.blank) continue;
				var v = (item.projections || {}).values || {};
				var st = v.sessionStats || {};
				var us = v.tokenUsage || {};
				var w = wsMap[item.sessionId];
				cards.push({
					id: item.sessionId, title: v.title || "\u65b0\u4f1a\u8bdd",
					running: item.running, isSub: item.origin === "subagent", parentId: item.parentSessionId,
					turns: st.turns || 0,
					tokens: (us.uncachedInputTokens || 0) + (us.outputTokens || 0) + (us.cacheReadTokens || 0) + (us.cacheWriteTokens || 0),
					ws: w ? w.title : "\u672a\u5206\u7ec4", wsId: w ? w.id : null,
				});
			}
			return cards;
		}

		var h = react.createElement;

		function StatCell(label, value) {
			return h("div", { style: { border: "1px solid " + C.border, borderRadius: "11px", padding: "10px 12px", background: "rgba(255,255,255,.02)" } },
				h("div", { style: { color: C.faint, fontSize: "10px", marginBottom: "3px", textTransform: "uppercase", letterSpacing: ".3px" } }, label),
				h("div", { style: { fontSize: "17px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: C.valueColor } }, value))
		}

		function SessionCard(card, onOpen) {
			var bt = card.running ? "run" : card.isSub ? "sub" : "idle";
			var bc = bt === "run" ? C.green : bt === "sub" ? C.amber : "rgba(255,255,255,.2)";
			return h("div", {
				style: { border: "1px solid " + C.border, borderRadius: "12px", padding: "12px 14px", background: "rgba(255,255,255,.02)", cursor: "pointer", transition: "border-color .15s" },
				onClick: function () { onOpen(card); },
				onMouseEnter: function (e) { e.currentTarget.style.borderColor = C.borderActive; },
				onMouseLeave: function (e) { e.currentTarget.style.borderColor = C.border; },
			},
				h("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" } },
					h("span", { style: { width: 8, height: 8, borderRadius: "50%", flex: "none", background: bc } }),
					h("span", { style: { fontWeight: 600, fontSize: "13px", color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, card.title),
					card.parentId ? h("span", { style: { fontSize: "9px", color: C.violet, border: "1px solid rgba(130,87,255,.3)", borderRadius: "4px", padding: "1px 5px", flex: "none" } }, card.isSub ? "sub" : "fork") : null,
				),
				h("div", { style: { fontSize: "11px", color: C.dim, display: "flex", gap: "12px" } },
					h("span", null, card.turns + " \u8f6e"),
					h("span", null, fmtTokens(card.tokens) + " tok"),
					h("span", null, card.ws)))
		}

		function WorkbenchSection(props) {
			var api = props.api;
			var st = react.useState("sessions"); var tab = st[0]; var setTab = st[1];
			var ss = react.useState(""); var search = ss[0]; var setSearch = ss[1];
			var sd = react.useState(null); var data = sd[0]; var setData = sd[1];
			var sl = react.useState(null); var daily = sl[0]; var setDaily = sl[1];
			var sa = react.useState(null); var activity = sa[0]; var setActivity = sa[1];
			var sr = react.useState(null); var runtime = sr[0]; var setRuntime = sr[1];
			var sm = react.useState(null); var saModel = sm[0]; var setSaModel = sm[1];
			var sv = react.useState(null); var models = sv[0]; var setModels = sv[1];
			var se = react.useState(null); var error = se[0]; var setError = se[1];
			var sc = react.useState([]); var cards = sc[0]; var setCards = sc[1];

			var refresh = react.useCallback(async function () {
				if (!api) return;
				try {
					var r = await fetchAllData(api);
					setCards(buildCards(r.sessions, r.workspaces));
					setData({ totals: aggregate(r.sessions) });
					setError(null);
					if (r.sessions.length > 0) {
						try {
							var mr = await api.sessions.models({ sessionId: r.sessions[0].sessionId });
							if (mr.result.ok) setModels(mr.result.value.groups);
						} catch { }
					}
				} catch (err) { setError(String((err && err.message) || err)); }
				try { setDaily(await fetchDaily()); } catch { setDaily(null); }
				try { setRuntime(await fetchRuntime()); } catch { setRuntime(null); }
				try { var s = await fetchSaModel(); setSaModel(s && s.current ? s.current : null); } catch { setSaModel(null); }
			}, [api]);

			react.useEffect(function () {
				refresh();
				var t = setInterval(refresh, 60000);
				return function () { clearInterval(t); };
			}, [refresh]);

			react.useEffect(function () {
				var f = async function () { try { setActivity(await fetchActivity()); } catch { setActivity(null); } };
				f();
				var t = setInterval(f, 10000);
				return function () { clearInterval(t); };
			}, []);

			var onOpen = function (card) { if (props.openSession) props.openSession(card.id); };
			var onModelChange = async function (p, m) {
				try {
					await postSaModel(p, m);
					setSaModel(p && m ? { provider: p, model: m } : null);
				} catch { }
			};

			var filtered = search
				? cards.filter(function (c) {
						return c.title.toLowerCase().includes(search.toLowerCase()) || c.ws.toLowerCase().includes(search.toLowerCase());
					})
				: cards;
			var groups = {}; var ungrouped = [];
			for (var card of filtered) {
				if (card.wsId) (groups[card.ws] = groups[card.ws] || []).push(card);
				else ungrouped.push(card);
			}

			var tabBtn = function (id, label) {
				var active = tab === id;
				return h("button", {
					style: {
						padding: "6px 14px", borderRadius: "8px",
						border: "1px solid " + (active ? "rgba(130,87,255,.3)" : C.border),
						background: active ? "rgba(130,87,255,.1)" : "transparent",
						color: active ? C.violet : C.dim, fontSize: "12px", cursor: "pointer",
						fontWeight: active ? 600 : 400,
					},
					onClick: function () { setTab(id); },
				}, label);
			};

			// Build children as a flat array — no deep ternary nesting
			var children = [];

			// Runtime badge
			if (runtime && runtime.current) {
				var badge = runtime.state === "updated" ? " \u2713 \u5df2\u5347\u7ea7" : runtime.state === "error" ? " \u2717 \u5347\u7ea7\u5931\u8d25" : "";
				children.push(h("div", { key: "rt", style: { padding: "8px 12px", border: "1px solid rgba(167,139,250,.3)", borderRadius: "10px", background: "rgba(130,87,255,.08)", fontSize: "11.5px", color: C.valueColor, marginBottom: "14px" } },
					h("b", { style: { color: "#fff" } }, "runtime v" + runtime.current), badge));
			}

			// Tab bar + refresh
			children.push(h("div", { key: "tabs", style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" } },
				h("div", { style: { display: "flex", gap: "4px" } },
					tabBtn("sessions", "\u{1F4CB} \u4f1a\u8bdd"),
					tabBtn("activity", "\u{1F527} \u6d3b\u52a8"),
					tabBtn("stats", "\u{1F4CA} \u7edf\u8ba1")),
				h("button", { style: { border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)", color: C.text, borderRadius: "8px", padding: "5px 12px", fontSize: "12px", cursor: "pointer" }, onClick: refresh }, "\u5237\u65b0")));

			// Error / loading
			if (error) children.push(h("div", { key: "err", style: { color: C.pink, fontSize: "13px", padding: "12px 0" } }, "\u52a0\u8f7d\u5931\u8d25\uff1a" + error));
			else if (!data) children.push(h("div", { key: "loading", style: { color: C.faint, fontSize: "13px", padding: "24px 0", textAlign: "center" } }, "\u52a0\u8f7d\u4e2d\u2026"));

			// Sessions tab
			if (data && tab === "sessions") {
				children.push(h("input", {
					key: "search", style: { width: "100%", padding: "9px 14px", border: "1px solid " + C.border, borderRadius: "10px", background: "rgba(255,255,255,.03)", color: C.text, fontSize: "13px", outline: "none", marginBottom: "14px", boxSizing: "border-box" },
					type: "text", placeholder: "\u641c\u7d22\u4f1a\u8bdd\u6216\u5de5\u4f5c\u533a\u2026", value: search,
					onChange: function (e) { setSearch(e.target.value); },
				}));

				if (Object.keys(groups).length === 0 && ungrouped.length === 0) {
					children.push(h("div", { key: "noResults", style: { color: C.faint, fontSize: "13px", padding: "24px 0", textAlign: "center" } },
						search ? "\u65e0\u5339\u914d\u7ed3\u679c" : "\u6682\u65e0\u4f1a\u8bdd"));
				} else {
					var wsKeys = Object.keys(groups).sort();
					for (var _wk = 0; _wk < wsKeys.length; _wk++) {
						(function (wsName) {
					children.push(h("div", { key: "ws-" + wsName, style: { marginBottom: "16px" } },
						h("div", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", fontWeight: 600, color: C.dim, marginBottom: "10px", textTransform: "uppercase" } },
							wsName, h("span", { style: { background: "rgba(130,87,255,.15)", color: C.violet, borderRadius: "4px", padding: "1px 6px", fontSize: "10px" } }, String(groups[wsName].length))),
						h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px" } },
							groups[wsName].map(function (c) { return h("div", { key: c.id }, SessionCard(c, onOpen)); }))
					));
						})(wsKeys[_wk]);
					}
					if (ungrouped.length > 0) {
						children.push(h("div", { key: "ungrouped", style: { marginBottom: "16px" } },
							h("div", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", fontWeight: 600, color: C.dim, marginBottom: "10px", textTransform: "uppercase" } },
								"\u672a\u5206\u7ec4", h("span", { style: { background: "rgba(130,87,255,.15)", color: C.violet, borderRadius: "4px", padding: "1px 6px", fontSize: "10px" } }, String(ungrouped.length))),
							h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px" } },
								ungrouped.map(function (c) { return h("div", { key: c.id }, SessionCard(c, onOpen)); }))
						));
					}
				}
			}

			// Activity tab
			if (tab === "activity") {
				if (!activity || !activity.events || activity.events.length === 0) {
					children.push(h("div", { key: "noAct", style: { color: C.faint, fontSize: "13px", padding: "24px 0", textAlign: "center" } }, "\u6682\u65e0\u6d3b\u52a8\u8bb0\u5f55"));
				} else {
					var icons = { tool: "\u{1F527}", approval: "\u26a0\ufe0f", session: "\u25b6\ufe0f", file: "\u{1F4DD}" };
					children.push(h("div", { key: "timeline", style: { display: "flex", flexDirection: "column", gap: "2px" } },
						activity.events.map(function (ev, i) {
							return h("div", { key: i, style: { display: "flex", alignItems: "center", gap: "12px", padding: "7px 12px", borderRadius: "8px", color: ev.kind === "approval" ? C.amber : ev.ok === false ? C.pink : C.text } },
								h("span", { style: { fontSize: "10px", color: C.faint, fontVariantNumeric: "tabular-nums", flex: "none", width: "56px" } }, fmtTime(ev.ts)),
								h("span", { style: { flex: "none", fontSize: "13px", width: "20px", textAlign: "center" } }, icons[ev.kind] || "\u2022"),
								h("span", { style: { flex: 1, fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, ev.label),
								ev.ms !== undefined ? h("span", { style: { fontSize: "10px", color: C.faint, flex: "none" } }, fmtDuration(ev.ms)) : null,
								ev.ok === false ? h("span", { style: { color: C.pink, fontSize: "10px" } }, "\u2717") : null);
						})));
				}
			}

			// Stats tab
			if (data && tab === "stats") {
				children.push(h("div", { key: "grid", style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", marginBottom: "16px" } },
					StatCell("\u4f1a\u8bdd / \u8fdb\u884c\u4e2d", data.totals.sessions + " / " + data.totals.active),
					StatCell("\u8f6e\u6b21 / \u6b65\u9aa4", data.totals.turns + " / " + data.totals.steps),
					StatCell("\u8f93\u5165 tokens", fmtTokens(data.totals.input)),
					StatCell("\u8f93\u51fa tokens", fmtTokens(data.totals.output)),
					StatCell("\u6a21\u578b\u65f6\u95f4", fmtDuration(data.totals.llmMs)),
					StatCell("\u5de5\u5177\u65f6\u95f4", fmtDuration(data.totals.toolMs))));

				if (daily) {
					var maxVal = Math.max.apply(null, daily.series.map(function (x) { return x.i + x.o + x.cr + x.cw; })) || 1;
					children.push(h("div", { key: "chart", style: { border: "1px solid " + C.border, borderRadius: "11px", padding: "14px", background: "rgba(255,255,255,.02)", marginBottom: "16px" } },
						h("div", { style: { display: "flex", alignItems: "flex-end", gap: "4px", height: "72px" } },
							daily.series.map(function (d, idx) {
								var total = d.i + d.o + d.cr + d.cw;
								var hv = total > 0 ? Math.max(8, Math.round((total / maxVal) * 100)) : 0;
								return h("div", { key: idx, style: { flex: 1, minWidth: 0, borderRadius: "4px", background: total === 0 ? "rgba(255,255,255,.08)" : "linear-gradient(180deg,#a78bfa,#8257ff 60%,#3b82f6)", height: total === 0 ? "2px" : hv + "%" }, title: d.date });
							})),
						h("div", { style: { display: "flex", gap: "4px", marginTop: "6px" } },
							daily.series.map(function (d, idx) {
								var show = idx === 0 || idx === daily.series.length - 1 || idx % 3 === 1;
								return h("span", { key: idx, style: { flex: 1, textAlign: "center", fontSize: "8.5px", color: C.faint } }, show ? d.date.slice(5) : "");
							}))));
				}

				// Subagent model picker
				var saChildren = [];
				saChildren.push(h("div", { key: "hdr", style: { fontSize: "12px", fontWeight: 600, color: C.dim, marginBottom: "8px" } }, "\u{1F916} Subagent \u6a21\u578b"));
				saChildren.push(h("div", { key: "hint", style: { fontSize: "11px", color: C.faint, marginBottom: "10px" } }, "\u6307\u5b9a\u5b50\u4ee3\u7406\u4f7f\u7528\u7684\u6a21\u578b\uff08\u4e0d\u5f71\u54cd\u4e3b\u4f1a\u8bdd\uff09\u3002\u66f4\u6539\u540e\u91cd\u542f\u751f\u6548\u3002"));
				var optChildren = [h("option", { key: "default", value: "" }, "\u7ee7\u627f\u7236\u4f1a\u8bdd\u6a21\u578b\uff08\u9ed8\u8ba4\uff09")];
				(models || []).forEach(function (g) {
					(g.models || []).forEach(function (m) {
						optChildren.push(h("option", { key: g.id + "/" + m.id, value: g.id + "/" + m.id }, m.name || m.id));
					});
				});
				saChildren.push(h("select", {
					key: "sel", style: { width: "100%", padding: "8px 12px", border: "1px solid rgba(255,255,255,.14)", borderRadius: "8px", background: "rgba(15,14,23,.8)", color: C.text, fontSize: "12px", outline: "none", cursor: "pointer" },
					value: saModel ? saModel.provider + "/" + saModel.model : "",
					onChange: function (e) {
						var v = e.target.value;
						if (!v) onModelChange(null, null);
						else { var p = v.split("/"); onModelChange(p[0], p.slice(1).join("/")); }
					},
				}, optChildren));
				if (saModel) {
					saChildren.push(h("div", { key: "cur", style: { marginTop: "8px", fontSize: "11px", color: C.valueColor } }, "\u5f53\u524d\uff1a" + saModel.provider + " / " + saModel.model));
				}
				children.push(h("div", { key: "sa", style: { border: "1px solid " + C.border, borderRadius: "12px", padding: "14px", background: "rgba(255,255,255,.02)", marginBottom: "16px" } }, saChildren));
			}

			return h("div", { style: { maxWidth: "800px", margin: "0 auto" } }, children);
		}

		function apply(ctx) {
			var conn = ctx.get("connection");
			var openSession = function (sessionId) {
				try {
					var sessions = ctx.get("sessions");
					if (sessions && sessions.select) sessions.select(sessionId);
				} catch { }
			};
			ctx.slots.inject("settings.section", function () {
				return ctx.slots.register(
					{ name: "settings.section", id: "workbench", order: 25, label: function () { return "Workbench"; } },
					function WorkbenchWrapper() {
						return h(WorkbenchSection, { api: conn ? conn.api : null, openSession: openSession });
					})
			})
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
})
