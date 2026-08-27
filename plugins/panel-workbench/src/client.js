// Web client side of the workbench panel plugin.
//
// This file IS the shipped bundle format: the DSH web shell installs
// window.__ModuleLoader__ before any plugin script runs, and executing this
// script registers our factory. React comes from the shell-seeded module
// graph. The factory's exports are consumed as a Cordis plugin on the web
// side; data is read through the connection service's RPC face
// (`api.sessions.list`), whose rows carry the session projections
// (`title`, `sessionStats`, `tokenUsage`) documented in dsh-host-apiproxy.
window.__ModuleLoader__.load({
	id: "@dsh-workbench/panel-workbench",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var react = require("react");

		var PLUGIN_VERSION = "0.4.0";

		// Service keys (same semantics as host-side cordis inject), as a
		// STATIC ARRAY — the web loader reads it before the fiber runs.
		var inject = ["slots", "connection"]

		function fmtTokens(n) {
			if (n === undefined || n === null) return "—"
			if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
			if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
			return String(n)
		}

		function fmtDuration(ms) {
			if (!ms) return "—"
			if (ms >= 3_600_000) return (ms / 3_600_000).toFixed(1) + "h"
			if (ms >= 60_000) return Math.round(ms / 60_000) + "m"
			return Math.round(ms / 1000) + "s"
		}

		function fmtRelative(ts) {
			var delta = Date.now() - ts
			var min = 60_000, hour = 3_600_000, day = 86_400_000
			if (delta < min) return "刚刚"
			if (delta < hour) return Math.floor(delta / min) + " 分钟前"
			if (delta < day) return Math.floor(delta / hour) + " 小时前"
			return Math.floor(delta / day) + " 天前"
		}

		/** Aggregate session rows (SessionSummary[]) into panel totals. */
		function aggregate(items) {
			var totals = {
				sessions: 0,
				active: 0,
				turns: 0,
				steps: 0,
				llmMs: 0,
				toolMs: 0,
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				coverage: 0,
			}
			var rows = []
			for (var item of items) {
				if (item.blank) continue
				totals.sessions += 1
				if (item.running) totals.active += 1
				var values = item.projections && item.projections.values
				if (!values) continue
				totals.coverage += 1
				var stats = values.sessionStats
				if (stats) {
					totals.turns += stats.turns || 0
					totals.steps += stats.steps || 0
					totals.llmMs += stats.llmMs || 0
					totals.toolMs += stats.toolMs || 0
				}
				var usage = values.tokenUsage
				if (usage) {
					totals.inputTokens += usage.uncachedInputTokens || 0
					totals.outputTokens += usage.outputTokens || 0
					totals.cacheReadTokens += usage.cacheReadTokens || 0
					totals.cacheWriteTokens += usage.cacheWriteTokens || 0
				}
				rows.push({
					title: values.title || "（无标题会话）",
					turns: stats ? stats.turns : undefined,
					tokens: usage
						? (usage.uncachedInputTokens || 0) +
							(usage.outputTokens || 0) +
							(usage.cacheReadTokens || 0) +
							(usage.cacheWriteTokens || 0)
						: undefined,
					running: item.running,
					updatedAt: item.updatedAt,
				})
			}
			rows.sort(function (a, b) {
				return b.updatedAt - a.updatedAt
			})
			return { totals: totals, rows: rows.slice(0, 8) }
		}

		async function fetchPanelData(api) {
			var response = await api.sessions.list({})
			var result = response.result
			if (!result.ok) throw new Error(result.error.message)
			return aggregate(result.value.items)
		}

		var cardStyle = {
			maxWidth: "720px",
			margin: "24px auto",
			padding: "20px 24px",
			border: "1px solid var(--dsw-alias-border-l1, #333)",
			borderRadius: "12px",
			background: "var(--dsw-alias-bg-base, #1a1a1a)",
			color: "var(--dsw-alias-label-primary, #eee)",
			fontSize: "14px",
			lineHeight: "1.7",
		}
		var titleStyle = { fontSize: "16px", fontWeight: 600, margin: "0 0 4px" }
		var subStyle = { color: "var(--dsw-alias-label-tertiary, #999)", fontSize: "12px", margin: "0 0 16px" }
		var gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px", margin: "0 0 20px" }
		var cellStyle = { padding: "10px 12px", border: "1px solid var(--dsw-alias-border-l2, #2a2a2a)", borderRadius: "8px" }
		var cellLabelStyle = { color: "var(--dsw-alias-label-tertiary, #999)", fontSize: "12px" }
		var cellValueStyle = { fontSize: "18px", fontWeight: 600, fontVariantNumeric: "tabular-nums" }
		var sectionTitleStyle = { fontSize: "13px", fontWeight: 600, margin: "0 0 8px", color: "var(--dsw-alias-label-secondary, #bbb)" }
		var tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "13px" }
		var thStyle = { textAlign: "left", fontWeight: 500, color: "var(--dsw-alias-label-tertiary, #999)", padding: "4px 8px", borderBottom: "1px solid var(--dsw-alias-border-l1, #333)" }
		var tdStyle = { padding: "6px 8px", borderBottom: "1px solid var(--dsw-alias-border-l2, #262626)", fontVariantNumeric: "tabular-nums" }
		var refreshStyle = { marginLeft: "8px", padding: "2px 10px", fontSize: "12px", borderRadius: "6px", border: "1px solid var(--dsw-alias-border-l2, #333)", background: "transparent", color: "inherit", cursor: "pointer" }
		var hintStyle = { marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--dsw-alias-border-l1, #333)", color: "var(--dsw-alias-label-tertiary, #999)", fontSize: "12px" }

		function StatCell(_ref) {
			var label = _ref.label, value = _ref.value
			return react.createElement("div", { style: cellStyle },
				react.createElement("div", { style: cellLabelStyle }, label),
				react.createElement("div", { style: cellValueStyle }, value))
		}

		function WorkbenchSection(_props) {
			var _react$useState = react.useState({ state: "loading" })
			var data = _react$useState[0], setData = _react$useState[1]
			var _react$useState2 = react.useState(null)
			var apiRef = _react$useState2[0], setApi = _react$useState2[1]

			react.useEffect(function () {
				// ctx is captured from the apply closure below.
				setApi(sharedCtx.get("connection").api)
			}, [])

			react.useEffect(
				function () {
					if (!apiRef) return
					var cancelled = false
					fetchPanelData(apiRef).then(
						function (agg) {
							if (!cancelled) setData({ state: "ready", agg: agg })
						},
						function (err) {
							if (!cancelled) setData({ state: "error", message: String(err && err.message ? err.message : err) })
						},
					)
					return function () {
						cancelled = true
					}
				},
				[apiRef],
			)

			var onRefresh = function () {
				if (!apiRef) return
				setData({ state: "loading" })
				fetchPanelData(apiRef).then(
					function (agg) {
						setData({ state: "ready", agg: agg })
					},
					function (err) {
						setData({ state: "error", message: String(err && err.message ? err.message : err) })
					},
				)
			}

			var header = react.createElement("div", null,
				react.createElement("h2", { style: titleStyle }, "dsh-workbench"),
				react.createElement("p", { style: subStyle },
					"面板插件 v" + PLUGIN_VERSION + " · 会话统计与用量"),
				react.createElement("button", { style: refreshStyle, type: "button", onClick: onRefresh }, "刷新"))

			if (data.state === "loading") {
				return react.createElement("div", { style: cardStyle }, header,
					react.createElement("p", null, "加载中…"))
			}
			if (data.state === "error") {
				return react.createElement("div", { style: cardStyle }, header,
					react.createElement("p", { style: { color: "var(--dsw-alias-state-error-primary, #e55)" } }, "加载失败：" + data.message))
			}

			var t = data.agg.totals
			return react.createElement("div", { style: cardStyle }, header,
				react.createElement("div", { style: gridStyle },
					react.createElement(StatCell, { label: "会话", value: String(t.sessions) }),
					react.createElement(StatCell, { label: "进行中", value: String(t.active) }),
					react.createElement(StatCell, { label: "累计轮次", value: String(t.turns) }),
					react.createElement(StatCell, { label: "累计步骤", value: String(t.steps) }),
					react.createElement(StatCell, { label: "模型时间", value: fmtDuration(t.llmMs) }),
					react.createElement(StatCell, { label: "工具时间", value: fmtDuration(t.toolMs) }),
					react.createElement(StatCell, { label: "输入 tokens", value: fmtTokens(t.inputTokens) }),
					react.createElement(StatCell, { label: "输出 tokens", value: fmtTokens(t.outputTokens) }),
					react.createElement(StatCell, { label: "缓存读", value: fmtTokens(t.cacheReadTokens) }),
					react.createElement(StatCell, { label: "缓存写", value: fmtTokens(t.cacheWriteTokens) })),
				react.createElement("h3", { style: sectionTitleStyle }, "最近会话"),
				react.createElement(
					"table",
					{ style: tableStyle },
					react.createElement("thead", null,
						react.createElement("tr", null,
							react.createElement("th", { style: thStyle }, "标题"),
							react.createElement("th", { style: thStyle }, "轮次"),
							react.createElement("th", { style: thStyle }, "tokens"),
							react.createElement("th", { style: thStyle }, "更新"))),
					react.createElement(
						"tbody",
						null,
						data.agg.rows.map(function (row) {
							return react.createElement(
								"tr",
								{ key: row.updatedAt + "|" + row.title },
								react.createElement("td", { style: tdStyle }, row.title + (row.running ? " ●" : "")),
								react.createElement("td", { style: tdStyle }, row.turns === undefined ? "—" : String(row.turns)),
								react.createElement("td", { style: tdStyle }, row.tokens === undefined ? "—" : fmtTokens(row.tokens)),
								react.createElement("td", { style: tdStyle }, fmtRelative(row.updatedAt)),
							)
						}),
					),
				),
				react.createElement("p", { style: hintStyle },
					"统计口径：全日志投影（sessionStats / tokenUsage），压缩与分页不影响数字；" +
						(t.coverage < t.sessions ? "部分冷会话投影暂缺，已按可用数据聚合。" : "提示：让 agent 运行 workbench_info 可获取环境快照。")),
			)
		}

		// The section component reads ctx via this module-level handle set in
		// apply(); fine for a single-instance settings section.
		var sharedCtx = null

		function apply(ctx) {
			sharedCtx = ctx
			console.warn("[workbench-panel] apply: web plugin started")
			// One startup probe: exercises the real data path once and lands in
			// the shell's forwarded web console (smoke visibility).
			Promise.resolve()
				.then(function () {
					return fetchPanelData(ctx.get("connection").api)
				})
				.then(
					function (agg) {
						console.warn(
							"[workbench-panel] stats probe ok: " +
								agg.totals.sessions + " sessions, " +
								agg.totals.turns + " turns, " +
								fmtTokens(agg.totals.inputTokens + agg.totals.outputTokens) + " tokens",
						)
					},
					function (err) {
						console.warn("[workbench-panel] stats probe failed:", err)
					},
				)
			ctx.slots.inject("settings.section", function () {
				return ctx.slots.register(
					{
						name: "settings.section",
						id: "workbench",
						order: 25,
						label: function () {
							return "Workbench"
						},
					},
					WorkbenchSection,
				)
			})
		}

		exports.apply = apply
		exports.inject = inject
		return module.exports
	},
})
