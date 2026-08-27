// Web client side of the workbench panel plugin.
//
// This file IS the shipped bundle format: the DSH web shell installs
// window.__ModuleLoader__ before any plugin script runs, and executing this
// script registers our factory. React and the slots module come from the
// shell-seeded module graph (see @deepseek-ai/dsh-client-modules README).
// The factory's exports are consumed as a Cordis plugin on the web side.
window.__ModuleLoader__.load({
	id: "@dsh-workbench/panel-workbench",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var react = require("react");

		var PLUGIN_VERSION = "0.3.0";

		var cardStyle = {
			maxWidth: "640px",
			margin: "24px auto",
			padding: "20px 24px",
			border: "1px solid var(--dsw-alias-border-l1, #333)",
			borderRadius: "12px",
			background: "var(--dsw-alias-bg-base, #1a1a1a)",
			color: "var(--dsw-alias-label-primary, #eee)",
			fontSize: "14px",
			lineHeight: "1.7",
		}
		var titleStyle = {
			fontSize: "16px",
			fontWeight: 600,
			margin: "0 0 12px",
		}
		var rowStyle = {
			display: "flex",
			justifyContent: "space-between",
			gap: "16px",
			padding: "4px 0",
		}
		var hintStyle = {
			marginTop: "12px",
			paddingTop: "12px",
			borderTop: "1px solid var(--dsw-alias-border-l1, #333)",
			color: "var(--dsw-alias-label-tertiary, #999)",
			fontSize: "12px",
		}

		function WorkbenchSection() {
			return react.createElement(
				"div",
				{ style: cardStyle },
				react.createElement("h2", { style: titleStyle }, "dsh-workbench"),
				react.createElement(
					"div",
					null,
					react.createElement("div", { style: rowStyle },
						react.createElement("span", null, "Panel plugin"),
						react.createElement("span", null, "v" + PLUGIN_VERSION)),
					react.createElement("div", { style: rowStyle },
						react.createElement("span", null, "Desktop shell"),
						react.createElement("span", null, "running")),
				),
				react.createElement(
					"p",
					{ style: hintStyle },
					"Tip: ask the agent \u201crun workbench_info\u201d for a full environment snapshot.",
				),
			)
		}

		// Service keys (same semantics as host-side cordis inject), as a
		// STATIC ARRAY — the web loader reads it before the fiber runs.
		var inject = ["slots"]

		function apply(ctx) {
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
