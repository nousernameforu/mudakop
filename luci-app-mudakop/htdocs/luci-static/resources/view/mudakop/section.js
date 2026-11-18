"use strict";
"require form";
"require baseclass";
"require fs";
"require ui";
"require uci";
"require tools.widgets as widgets";
"require view.mudakop.main as main";

// A section carries five dozen options, most of which are irrelevant for any given
// connection type, so the rows are folded into collapsible groups. The names must match
// the options declared in createSectionContent; anything missing from a group is simply
// left where it was rendered
const FIELD_GROUPS = [
  {
    name: "connection",
    title: _("Connection"),
    collapsed: false,
    options: [
      "connection_type",
      "proxy_config_type",
      "proxy_string",
      "outbound_json",
      "endpoint_json",
      "_awg_summary",
      "_awg_configure",
      "subscription_url",
      "_subscription_status",
      "_subscription_import",
      "subscription_auto_update",
      "selector_proxy_links",
      "urltest_proxy_links",
      "urltest_check_interval",
      "urltest_tolerance",
      "urltest_testing_url",
      "enable_udp_over_tcp",
      "interface",
    ],
  },
  {
    name: "resolver",
    title: _("Domain Resolver"),
    collapsed: true,
    options: [
      "domain_resolver_enabled",
      "domain_resolver_dns_type",
      "domain_resolver_dns_server",
    ],
  },
  {
    name: "routing",
    title: _("User Domains and Subnets"),
    collapsed: true,
    options: [
      "user_domain_list_type",
      "user_domains",
      "user_domains_text",
      "user_subnet_list_type",
      "user_subnets",
      "user_subnets_text",
    ],
  },
  {
    name: "lists",
    title: _("External Lists"),
    collapsed: true,
    options: [
      "local_domain_lists",
      "local_subnet_lists",
      "remote_domain_lists",
      "remote_subnet_lists",
    ],
  },
  {
    name: "advanced",
    title: _("Advanced"),
    collapsed: true,
    options: [
      "fully_routed_macs",
      "fully_routed_ips",
      "tunnel_ipv6",
      "mixed_proxy_enabled",
      "mixed_proxy_port",
      "resolve_real_ip_for_routing",
      "disable_quic",
    ],
  },
];

// Which option a subscription import feeds, per proxy configuration type. Only the
// group types take a list of servers; the single-outbound types have nothing to fill
const SUBSCRIPTION_TARGETS = {
  selector: "selector_proxy_links",
  urltest: "urltest_proxy_links",
};

// Collapsed state lives here rather than in the DOM: LuCI rebuilds the whole map on
// save, add and remove, and re-collapsing everything under the user would be rude. It
// is mirrored into localStorage so a reload, or coming back to the page tomorrow, finds
// the groups folded the way they were left. Keys are "<section id>/<group name>"
const COLLAPSE_STORAGE_KEY = "mudakop.collapsed";

function loadCollapseState() {
  try {
    const stored = JSON.parse(localStorage.getItem(COLLAPSE_STORAGE_KEY));

    return stored && typeof stored === "object" ? stored : {};
  } catch (e) {
    // Unreadable or unavailable storage only costs the remembered state
    return {};
  }
}

const collapseState = loadCollapseState();

function persistCollapseState() {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(collapseState));
  } catch (e) {
    // Storage can be full or disabled; the state still holds for this page
  }
}

function setCollapsed(key, collapsed) {
  collapseState[key] = collapsed;
  persistCollapseState();
}

// Drops what is left over from sections that have since been renamed or removed, so the
// stored state cannot grow without bound
function pruneCollapseState(sectionIds) {
  const stale = Object.keys(collapseState).filter(
    (key) => sectionIds.indexOf(key.split("/")[0]) === -1,
  );

  if (!stale.length) {
    return;
  }

  stale.forEach((key) => delete collapseState[key]);
  persistCollapseState();
}

const SECTION_STYLES = `
.mudakop-group {
  border: 1px solid var(--border-color-medium, #ddd);
  border-radius: 4px;
  margin: 0 0 8px;
}
.mudakop-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  padding: 8px 10px;
  font-weight: 600;
  background: var(--background-color-medium, rgba(0, 0, 0, 0.03));
}
.mudakop-group-body {
  padding: 8px 10px 2px;
}
.mudakop-group.mudakop-collapsed > .mudakop-group-body {
  display: none;
}
.mudakop-chevron {
  display: inline-block;
  transition: transform 0.15s ease;
  font-size: 80%;
  opacity: 0.7;
}
.mudakop-collapsed .mudakop-chevron {
  transform: rotate(-90deg);
}
.mudakop-sub-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 2px;
  cursor: pointer;
}
.mudakop-sub-row:not(:last-child) {
  border-bottom: 1px solid var(--border-color-low, rgba(0, 0, 0, 0.06));
}
.mudakop-sub-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mudakop-sub-meta {
  font-size: 85%;
  opacity: 0.7;
  white-space: nowrap;
}
`;

function injectSectionStyles() {
  if (document.getElementById("mudakop-section-styles")) {
    return;
  }

  document.head.appendChild(
    E("style", { id: "mudakop-section-styles" }, SECTION_STYLES),
  );
}

function isCollapsed(key, fallback) {
  return Object.prototype.hasOwnProperty.call(collapseState, key)
    ? collapseState[key]
    : fallback;
}

// Keeps a group out of the way while every option inside it is switched off by a
// dependency, and pops it back open when a widget in it fails validation, so an error
// can never hide behind a collapsed header
function watchGroup(container, body, key) {
  function sync() {
    const rows = body.querySelectorAll(".cbi-value");
    const visible = Array.prototype.some.call(
      rows,
      (row) => !row.classList.contains("hidden"),
    );

    container.style.display = visible ? "" : "none";

    if (body.querySelector(".cbi-input-invalid")) {
      container.classList.remove("mudakop-collapsed");
      setCollapsed(key, false);
    }
  }

  // Dependencies toggle the "hidden" class on a row, validation toggles
  // "cbi-input-invalid" on an input, and a widget such as a dynamic list swaps whole
  // nodes in and out, so both kinds of mutation matter here
  new MutationObserver(sync).observe(body, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true,
  });

  sync();
}

function groupSectionRows(node, section_id) {
  const rows = {};

  node.querySelectorAll(".cbi-value[data-name]").forEach((row) => {
    rows[row.getAttribute("data-name")] = row;
  });

  FIELD_GROUPS.forEach((group) => {
    const groupRows = group.options
      .map((name) => rows[name])
      .filter((row) => !!row);

    if (!groupRows.length) {
      return;
    }

    const key = section_id + "/" + group.name;
    const body = E("div", { class: "mudakop-group-body" }, groupRows);
    const container = E("div", { class: "mudakop-group" }, [
      E(
        "div",
        {
          class: "mudakop-group-header",
          click: function () {
            setCollapsed(key, container.classList.toggle("mudakop-collapsed"));
          },
        },
        [
          E("span", { class: "mudakop-chevron" }, "▾"),
          E("span", {}, group.title),
        ],
      ),
      body,
    ]);

    if (isCollapsed(key, group.collapsed)) {
      container.classList.add("mudakop-collapsed");
    }

    node.appendChild(container);
    watchGroup(container, body, key);
  });
}

function applyCollapsibleLayout(root) {
  injectSectionStyles();

  const sectionIds = [];

  root.querySelectorAll(".cbi-section-node[data-section-id]").forEach((node) => {
    const section_id = node.getAttribute("data-section-id");
    sectionIds.push(section_id);

    if (node.classList.contains("mudakop-grouped")) {
      return;
    }

    node.classList.add("mudakop-grouped");

    groupSectionRows(node, section_id);
  });

  pruneCollapseState(sectionIds);
}

// ------------------------------------------------------------------ subscriptions
function lookupWidget(map, section_id, name) {
  const found = map.lookupOption(name, section_id);
  const option = found && found[0];

  return option ? option.getUIElement(section_id) : null;
}

// Prefers what is in the form over what is in uci, so an import works with a
// subscription URL or a configuration type the user has not saved yet
function readOptionValue(map, section_id, name) {
  const widget = lookupWidget(map, section_id, name);
  const value = widget ? widget.getValue() : uci.get("mudakop", section_id, name);

  return value == null ? "" : value;
}

function toList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}

function readProxyLinks(map, section_id, name) {
  return toList(readOptionValue(map, section_id, name));
}

// Writes to both uci and the widget: uci alone would be overwritten by the form on
// save, and the widget alone would leave the summary line stale.
//
// An empty value is unset rather than set: ubus rejects an empty string or an empty list
// with "Invalid argument", which fails the whole form save, and an absent option is what
// "nothing here" means in uci anyway
function writeOptionValue(map, section_id, name, value) {
  const list = Array.isArray(value);
  const empty = list ? value.length === 0 : value == null || String(value) === "";

  if (empty) {
    uci.unset("mudakop", section_id, name);
  } else {
    uci.set("mudakop", section_id, name, value);
  }

  const widget = lookupWidget(map, section_id, name);
  if (widget) {
    widget.setValue(empty && list ? [] : empty ? "" : value);
  }
}

function formatSubscriptionStamp(value) {
  const seconds = parseInt(value, 10);

  if (!seconds || isNaN(seconds)) {
    return "";
  }

  return new Date(seconds * 1000).toLocaleString();
}

function subscriptionStatusText(section_id) {
  const stamp = formatSubscriptionStamp(
    uci.get("mudakop", section_id, "subscription_updated"),
  );

  if (!stamp) {
    return _("Nothing imported yet");
  }

  const served = toList(
    uci.get("mudakop", section_id, "subscription_links"),
  ).length;
  const hidden = toList(
    uci.get("mudakop", section_id, "subscription_excluded"),
  ).length;

  return _("Last refresh: %s · %d server(s) offered, %d removed by you").format(
    stamp,
    served,
    hidden,
  );
}

function setSubscriptionStatusText(section_id, text) {
  const row = document.getElementById(
    "cbi-mudakop-%s-_subscription_status".format(section_id),
  );
  const field = row && row.querySelector(".cbi-value-field");

  if (field) {
    field.textContent = text;
  }
}

// Pulls out what can be shown about a link without decoding credentials: the protocol,
// the "#name" the provider attached, and the host:port it points at
function describeProxyLink(link) {
  const separator = link.indexOf("://");
  const scheme = separator === -1 ? "" : link.slice(0, separator);
  const rest = separator === -1 ? link : link.slice(separator + 3);
  const hash = rest.indexOf("#");

  let name = "";
  if (hash !== -1) {
    const raw = rest.slice(hash + 1);
    try {
      name = decodeURIComponent(raw);
    } catch (e) {
      name = raw;
    }
  }

  const body = hash === -1 ? rest : rest.slice(0, hash);
  const authority = body.split("?")[0].split("/")[0];
  const at = authority.lastIndexOf("@");

  return {
    scheme,
    name,
    address: at === -1 ? authority : authority.slice(at + 1),
  };
}

// The router does the downloading: the browser cannot reach a subscription host that is
// only routed through the router, and would be blocked by CORS even when it can. Args
// are passed to execv, not to a shell, so the URL needs no escaping
async function fetchSubscription(url) {
  let response;

  try {
    response = await fs.exec("/usr/bin/mudakop", ["fetch_subscription", url]);
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }

  try {
    return JSON.parse(response.stdout || "");
  } catch (e) {
    return {
      success: false,
      error: response.stderr || _("Unexpected response from the router"),
    };
  }
}

function showSubscriptionModal(map, section_id) {
  const proxyConfigType = readOptionValue(map, section_id, "proxy_config_type");
  const target = SUBSCRIPTION_TARGETS[proxyConfigType];

  if (!target) {
    ui.addNotification(
      null,
      E("p", {}, _("Subscriptions are only available for the Selector and URLTest configuration types")),
      "error",
    );
    return;
  }

  // Every rendered server row, so the buttons below can collect what is ticked
  let entries = [];

  const urlInput = E("input", {
    type: "text",
    class: "cbi-input-text",
    style: "width: 100%",
    value: readOptionValue(map, section_id, "subscription_url") || "",
    placeholder: "https://example.com/subscription",
  });

  const resultBox = E("div", { style: "margin-top: 12px" });

  function selectedLinks() {
    return entries
      .filter((entry) => entry.checkbox.checked)
      .map((entry) => entry.link);
  }

  // Leaves the section in the state the scheduled refresh expects: the link list holds
  // what the section uses, subscription_links holds everything the provider served, and
  // subscription_excluded holds the rest. A server left unticked here is a rejection,
  // and it stays rejected through every later refresh
  function apply(mode) {
    const links = selectedLinks();

    if (!links.length) {
      ui.addNotification(null, E("p", {}, _("No servers selected")), "warning");
      return;
    }

    const fetched = entries.map((entry) => entry.link);
    const existing = mode === "replace" ? [] : readProxyLinks(map, section_id, target);
    const merged = existing.concat(
      links.filter((link) => existing.indexOf(link) === -1),
    );

    // Deriving the exclusions from the resulting list rather than from the ticks keeps
    // "Add to list" honest: it never rejects a server the section already had
    const excluded = readProxyLinks(map, section_id, "subscription_excluded")
      .concat(fetched)
      .filter((link, index, all) => all.indexOf(link) === index)
      .filter((link) => merged.indexOf(link) === -1);

    writeOptionValue(map, section_id, target, merged);
    writeOptionValue(map, section_id, "subscription_links", fetched);
    writeOptionValue(map, section_id, "subscription_excluded", excluded);
    writeOptionValue(map, section_id, "subscription_url", urlInput.value.trim());
    uci.set(
      "mudakop",
      section_id,
      "subscription_updated",
      String(Math.floor(Date.now() / 1000)),
    );
    setSubscriptionStatusText(section_id, subscriptionStatusText(section_id));

    ui.hideModal();
    ui.addNotification(
      null,
      E("p", {}, _("Imported %d server(s). Press Save & Apply to use them").format(links.length)),
      "info",
    );
  }

  const replaceButton = E(
    "button",
    {
      class: "btn cbi-button-positive",
      disabled: "disabled",
      click: function () {
        apply("replace");
      },
    },
    _("Replace list"),
  );

  const appendButton = E(
    "button",
    {
      class: "btn cbi-button-action",
      disabled: "disabled",
      click: function () {
        apply("append");
      },
    },
    _("Add to list"),
  );

  function setButtonsEnabled(enabled) {
    [replaceButton, appendButton].forEach((button) => {
      if (enabled) {
        button.removeAttribute("disabled");
      } else {
        button.setAttribute("disabled", "disabled");
      }
    });
  }

  function showMessage(text, style) {
    resultBox.textContent = "";
    resultBox.appendChild(E("p", { class: style || "" }, text));
  }

  function renderServers(data) {
    const links = data.links || [];
    const current = readProxyLinks(map, section_id, target);
    const excluded = readProxyLinks(map, section_id, "subscription_excluded");

    // A server already in the list stays ticked, one turned down before stays unticked,
    // and anything the provider has added since is offered ticked
    entries = links.map((link) => {
      const wanted =
        current.indexOf(link) !== -1 || excluded.indexOf(link) === -1;

      return {
        link,
        wanted,
        checkbox: E(
          "input",
          wanted ? { type: "checkbox", checked: "checked" } : { type: "checkbox" },
        ),
      };
    });

    const selectAll = E("input", {
      type: "checkbox",
      checked: "checked",
      change: function (ev) {
        entries.forEach((entry) => {
          entry.checkbox.checked = ev.target.checked;
        });
      },
    });

    const rows = entries.map((entry) => {
      const meta = describeProxyLink(entry.link);

      return E("label", { class: "mudakop-sub-row" }, [
        entry.checkbox,
        E("span", { class: "mudakop-sub-name" }, meta.name || meta.address),
        E("span", { class: "mudakop-sub-meta" }, "%s · %s".format(meta.scheme, meta.address)),
      ]);
    });

    const rejected = entries.filter((entry) => !entry.wanted).length;

    resultBox.textContent = "";
    resultBox.appendChild(
      E("label", { class: "mudakop-sub-row" }, [
        selectAll,
        E(
          "span",
          { class: "mudakop-sub-name" },
          rejected
            ? _("Found %d server(s), %d of them removed by you before").format(links.length, rejected)
            : _("Found %d server(s)").format(links.length),
        ),
      ]),
    );
    resultBox.appendChild(
      E(
        "div",
        {
          style:
            "max-height: 45vh; overflow-y: auto; border: 1px solid var(--border-color-medium, #ccc); padding: 4px 8px",
        },
        rows,
      ),
    );

    if (data.skipped) {
      resultBox.appendChild(
        E("p", {}, _("Skipped %d entr(ies) using a protocol mudakop cannot build an outbound from").format(data.skipped)),
      );
    }

    setButtonsEnabled(links.length > 0);
  }

  const fetchButton = E(
    "button",
    {
      class: "btn cbi-button-action",
      click: async function () {
        const url = urlInput.value.trim();

        if (!/^https?:\/\//i.test(url)) {
          showMessage(_("Enter a subscription URL starting with http:// or https://"));
          return;
        }

        entries = [];
        setButtonsEnabled(false);
        fetchButton.setAttribute("disabled", "disabled");
        showMessage(_("Downloading the subscription…"));

        try {
          const data = await fetchSubscription(url);

          if (data && data.success) {
            renderServers(data);
          } else {
            showMessage((data && data.error) || _("Failed to read the subscription"));
          }
        } finally {
          fetchButton.removeAttribute("disabled");
        }
      },
    },
    _("Fetch"),
  );

  ui.showModal(_("Import Subscription"), [
    E("p", {}, _("The router downloads the subscription and lists the servers it carries. Pick the ones to put into the %s list").format(
      proxyConfigType === "urltest" ? _("URLTest Proxy Links") : _("Selector Proxy Links"),
    )),
    E("div", { class: "cbi-value" }, [
      E("label", { class: "cbi-value-title" }, _("Subscription URL")),
      E("div", { class: "cbi-value-field" }, urlInput),
    ]),
    E("div", {}, [fetchButton]),
    resultBox,
    E("div", { class: "right", style: "margin-top: 10px" }, [
      E("button", { class: "btn", click: ui.hideModal }, _("Cancel")),
      " ",
      appendButton,
      " ",
      replaceButton,
    ]),
  ]);
}

// Maps an AmneziaWG .conf key onto the uci option that holds it. Only the keys a .conf
// can actually carry are listed: the id/ip/ib junk generator is a sing-box-lx concept
// with no .conf equivalent, so importing never touches it
const AWG_CONF_INTERFACE_KEYS = {
  privatekey: "awg_private_key",
  mtu: "awg_mtu",
  jc: "awg_jc",
  jmin: "awg_jmin",
  jmax: "awg_jmax",
  s1: "awg_s1",
  s2: "awg_s2",
  s3: "awg_s3",
  s4: "awg_s4",
  h1: "awg_h1",
  h2: "awg_h2",
  h3: "awg_h3",
  h4: "awg_h4",
  i1: "awg_i1",
  i2: "awg_i2",
  i3: "awg_i3",
  i4: "awg_i4",
  i5: "awg_i5",
};

const AWG_CONF_PEER_KEYS = {
  publickey: "awg_peer_public_key",
  presharedkey: "awg_peer_pre_shared_key",
  persistentkeepalive: "awg_peer_persistent_keepalive",
};

// Splits "host:port", including the bracketed IPv6 form "[2001:db8::1]:51820"
function splitEndpoint(value) {
  const bracketed = value.match(/^\[(.+)\]:(\d+)$/);
  if (bracketed) {
    return { address: bracketed[1], port: bracketed[2] };
  }

  const idx = value.lastIndexOf(":");
  if (idx === -1) {
    return { address: value, port: "" };
  }

  return { address: value.slice(0, idx), port: value.slice(idx + 1) };
}

function splitList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Parses a WireGuard/AmneziaWG .conf into { iface, peer } key/value maps
function parseAmneziaConf(text) {
  const result = { iface: {}, peer: {} };
  let current = null;

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.replace(/[#;].*$/, "").trim();
    if (!line) {
      return;
    }

    const header = line.match(/^\[(\w+)\]$/);
    if (header) {
      current = header[1].toLowerCase();
      return;
    }

    const pair = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!pair || !current) {
      return;
    }

    const key = pair[1].toLowerCase();
    const value = pair[2].trim();

    if (current === "interface") {
      result.iface[key] = value;
    } else if (current === "peer") {
      result.peer[key] = value;
    }
  });

  return result;
}

// Maps a parsed .conf onto uci option names. The id/ip/ib generator has no .conf
// equivalent, so importing never produces those keys
function confToAwgValues(parsed) {
  const values = {};

  Object.keys(AWG_CONF_INTERFACE_KEYS).forEach((key) => {
    if (parsed.iface[key]) {
      values[AWG_CONF_INTERFACE_KEYS[key]] = parsed.iface[key];
    }
  });

  Object.keys(AWG_CONF_PEER_KEYS).forEach((key) => {
    if (parsed.peer[key]) {
      values[AWG_CONF_PEER_KEYS[key]] = parsed.peer[key];
    }
  });

  if (parsed.iface.address) {
    values.awg_addresses = splitList(parsed.iface.address);
  }

  if (parsed.peer.allowedips) {
    values.awg_peer_allowed_ips = splitList(parsed.peer.allowedips);
  }

  if (parsed.peer.endpoint) {
    const endpoint = splitEndpoint(parsed.peer.endpoint);
    values.awg_peer_address = endpoint.address;
    if (endpoint.port) {
      values.awg_peer_port = endpoint.port;
    }
  }

  // A .conf can only describe junk packets as I1-I5
  if (Object.keys(parsed.iface).some((k) => /^i[1-5]$/.test(k))) {
    values.awg_junk_mode = "packets";
  }

  return values;
}

// Turns luci-rpc host hints into [address, label] choices, one per address, named after
// the device so it can be picked from a list instead of looked up by hand. Link-local
// IPv6 addresses never reach the router's forwarding path, so they are left out
function hostHintsToChoices(hostHints) {
  const choices = [];

  Object.keys(hostHints || {}).forEach((mac) => {
    const host = hostHints[mac] || {};
    const name = host.name || mac;
    const addrs = [].concat(host.ipaddrs || [], host.ip6addrs || []);

    addrs
      .filter((addr) => addr && !/^fe80:/i.test(addr))
      .forEach((addr) => choices.push([addr, `${name} (${addr})`, name]));
  });

  choices.sort((a, b) => a[2].localeCompare(b[2]) || a[0].localeCompare(b[0]));

  return choices;
}

// One [mac, label] choice per known device. MACs are stored lower-case, which is what
// the backend normalises to as well, so a picked device and a typed one compare equal
function hostHintsToMacChoices(hostHints) {
  return Object.keys(hostHints || {})
    .filter((mac) => MAC_REGEX.test(mac))
    .map((mac) => {
      const host = hostHints[mac] || {};
      const addr = (host.ipaddrs || [])[0] || (host.ip6addrs || [])[0];
      const name = host.name || _("Unknown device");
      const label = addr ? `${name} (${addr}, ${mac})` : `${name} (${mac})`;

      return [mac.toLowerCase(), label, name];
    })
    .sort((a, b) => a[2].localeCompare(b[2]) || a[0].localeCompare(b[0]));
}

const MAC_REGEX = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i;

function createSectionContent(section, options = {}) {
  const { amneziaWgAvailable = false, hostHints = {} } = options;

  // Field schema for the AmneziaWG editor. Declaring it once keeps the modal, the .conf
  // importer and the uci writer working from a single source of truth instead of two
  // dozen near-identical widget blocks
  const AWG_GROUPS = [
    {
      title: _("Interface"),
      fields: [
        {
          name: "awg_private_key",
          label: _("Private Key"),
          password: true,
          required: true,
        },
        {
          name: "awg_addresses",
          label: _("Interface Addresses"),
          list: true,
          required: true,
          placeholder: "10.5.4.2/32, fd42:5:4::2/128",
        },
        { name: "awg_mtu", label: _("MTU"), placeholder: "1280" },
      ],
    },
    {
      title: _("Peer"),
      fields: [
        {
          name: "awg_peer_address",
          label: _("Peer Address"),
          required: true,
          placeholder: "185.23.236.193",
        },
        {
          name: "awg_peer_port",
          label: _("Peer Port"),
          required: true,
          placeholder: "51820",
        },
        {
          name: "awg_peer_public_key",
          label: _("Peer Public Key"),
          required: true,
        },
        {
          name: "awg_peer_pre_shared_key",
          label: _("Peer Pre-shared Key"),
          password: true,
        },
        {
          name: "awg_peer_allowed_ips",
          label: _("Allowed IPs"),
          list: true,
          required: true,
          placeholder: "0.0.0.0/0, ::/0",
        },
        {
          name: "awg_peer_persistent_keepalive",
          label: _("Persistent Keepalive"),
          placeholder: "25",
        },
      ],
    },
    {
      title: _("Obfuscation"),
      fields: ["jc", "jmin", "jmax", "s1", "s2", "s3", "s4"]
        .map((f) => ({ name: "awg_" + f, label: f.toUpperCase() }))
        .concat(
          ["h1", "h2", "h3", "h4"].map((f) => ({
            name: "awg_" + f,
            label: f.toUpperCase(),
            placeholder: "39602205-139602204",
          })),
        ),
    },
  ];

  const AWG_JUNK_PACKET_FIELDS = ["i1", "i2", "i3", "i4", "i5"].map((f) => ({
    name: "awg_" + f,
    label: f.toUpperCase(),
  }));

  const AWG_JUNK_GENERATED_FIELDS = [
    {
      name: "awg_id",
      label: "ID",
      placeholder: "www.ozon.ru",
    },
    { name: "awg_ip", label: "IP", placeholder: "quic" },
    { name: "awg_ib", label: "IB", placeholder: "firefox" },
  ];

  function showAmneziaWgModal(map, section_id) {
    const inputs = {};

    function renderField(field) {
      const stored = uci.get("mudakop", section_id, field.name);
      const initial = Array.isArray(stored) ? stored.join(", ") : stored || "";

      const input = E("input", {
        type: field.password ? "password" : "text",
        class: "cbi-input-text",
        value: initial,
        placeholder: field.placeholder || "",
        style: "width: 100%",
      });

      inputs[field.name] = {
        input,
        list: !!field.list,
        required: !!field.required,
        label: field.label,
      };

      return E("div", { class: "cbi-value" }, [
        E("label", { class: "cbi-value-title" }, field.label),
        E("div", { class: "cbi-value-field" }, input),
      ]);
    }

    function renderGroup(title, fields) {
      return E("div", { style: "margin-bottom: 14px" }, [
        E("h4", { style: "margin: 0 0 6px" }, title),
        E("div", {}, fields.map(renderField)),
      ]);
    }

    const junkPacketsBox = E(
      "div",
      {},
      AWG_JUNK_PACKET_FIELDS.map(renderField),
    );
    const junkGeneratedBox = E(
      "div",
      {},
      AWG_JUNK_GENERATED_FIELDS.map(renderField),
    );

    const junkSelect = E("select", { class: "cbi-input-select" }, [
      E("option", { value: "packets" }, _("I1-I5 templates")),
      E("option", { value: "generated" }, _("Generated (id/ip/ib)")),
    ]);
    junkSelect.value =
      uci.get("mudakop", section_id, "awg_junk_mode") || "packets";

    function syncJunkMode() {
      const generated = junkSelect.value === "generated";
      junkPacketsBox.style.display = generated ? "none" : "";
      junkGeneratedBox.style.display = generated ? "" : "none";
    }

    junkSelect.addEventListener("change", syncJunkMode);

    // --- import panel, collapsed until asked for -------------------------------
    const importText = E("textarea", {
      class: "cbi-input-textarea",
      style: "width: 100%; min-height: 200px; font-family: monospace",
      placeholder:
        "[Interface]\nPrivateKey = ...\nAddress = 10.5.4.2/32\nJc = 5\n\n[Peer]\nPublicKey = ...\nEndpoint = 1.2.3.4:51820\nAllowedIPs = 0.0.0.0/0",
    });

    const importFile = E("input", {
      type: "file",
      accept: ".conf,text/plain",
      change: function (ev) {
        const file = ev.target.files && ev.target.files[0];
        if (!file) {
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          importText.value = String(reader.result || "");
        };
        reader.onerror = () => {
          ui.addNotification(
            null,
            E("p", {}, _("Could not read the selected file")),
            "error",
          );
        };
        reader.readAsText(file);
      },
    });

    function fillFromConf() {
      const text = importText.value || "";

      if (!text.trim()) {
        ui.addNotification(
          null,
          E("p", {}, _("Nothing to import: paste a configuration or choose a file")),
          "warning",
        );
        return;
      }

      const parsed = parseAmneziaConf(text);

      if (!parsed.iface.privatekey || !parsed.peer.publickey) {
        ui.addNotification(
          null,
          E("p", {}, _("This does not look like a WireGuard or AmneziaWG configuration: no PrivateKey or PublicKey found")),
          "error",
        );
        return;
      }

      const values = confToAwgValues(parsed);
      let filled = 0;

      Object.keys(values).forEach((name) => {
        if (name === "awg_junk_mode") {
          junkSelect.value = values[name];
          syncJunkMode();
          return;
        }

        if (!inputs[name]) {
          return;
        }

        const value = values[name];
        inputs[name].input.value = Array.isArray(value)
          ? value.join(", ")
          : value;
        filled++;
      });

      ui.addNotification(
        null,
        E("p", {}, _("Filled %d field(s) from the file. Review them, then press Save").format(filled)),
        "info",
      );
    }

    const importPanel = E(
      "div",
      { style: "display: none; margin: 8px 0 16px; padding: 10px; border: 1px solid var(--border-color-medium, #ccc)" },
      [
        E("div", { style: "margin-bottom: 8px" }, importFile),
        importText,
        E("div", { style: "margin-top: 8px" }, [
          E(
            "button",
            { class: "btn cbi-button-action", click: fillFromConf },
            _("Fill fields"),
          ),
        ]),
      ],
    );

    const importToggle = E(
      "button",
      {
        class: "btn",
        click: function () {
          importPanel.style.display =
            importPanel.style.display === "none" ? "" : "none";
        },
      },
      _("Import from .conf"),
    );

    // --- save ------------------------------------------------------------------
    function save() {
      const missing = Object.keys(inputs)
        .filter((name) => inputs[name].required && !inputs[name].input.value.trim())
        .map((name) => inputs[name].label);

      if (missing.length) {
        ui.addNotification(
          null,
          E("p", {}, _("Required fields are empty: %s").format(missing.join(", "))),
          "error",
        );
        return;
      }

      Object.keys(inputs).forEach((name) => {
        const meta = inputs[name];
        const raw = meta.input.value.trim();

        if (!raw) {
          uci.unset("mudakop", section_id, name);
          return;
        }

        uci.set("mudakop", section_id, name, meta.list ? splitList(raw) : raw);
      });

      // Values for the unselected junk mode are deliberately kept: the router only
      // reads the mode in force, so switching back and forth does not lose them
      uci.set("mudakop", section_id, "awg_junk_mode", junkSelect.value);

      ui.hideModal();
      ui.addNotification(
        null,
        E("p", {}, _("AmneziaWG configuration updated. Press Save & Apply to write it to the router")),
        "info",
      );

      try {
        map.renderContents();
      } catch (e) {
        // The summary line refreshes on the next page load
      }
    }

    ui.showModal(_("AmneziaWG Configuration"), [
      E("div", { style: "margin-bottom: 12px" }, [importToggle]),
      importPanel,
      E(
        "div",
        { style: "max-height: 60vh; overflow-y: auto" },
        AWG_GROUPS.map((group) => renderGroup(group.title, group.fields)).concat([
          E("div", { style: "margin-bottom: 14px" }, [
            E("h4", { style: "margin: 0 0 6px" }, _("Junk Packets")),
            E("div", { class: "cbi-value" }, [
              E("label", { class: "cbi-value-title" }, _("Mode")),
              E("div", { class: "cbi-value-field" }, junkSelect),
            ]),
            junkPacketsBox,
            junkGeneratedBox,
          ]),
        ]),
      ),
      E("div", { class: "right", style: "margin-top: 10px" }, [
        E("button", { class: "btn", click: ui.hideModal }, _("Cancel")),
        " ",
        E("button", { class: "btn cbi-button-positive", click: save }, _("Save")),
      ]),
    ]);

    syncJunkMode();
  }

  let o = section.option(
    form.ListValue,
    "connection_type",
    _("Connection Type"),
    _("Select between VPN and Proxy connection methods for traffic routing"),
  );
  o.value("proxy", "Proxy");
  o.value("vpn", "VPN");
  if (amneziaWgAvailable) {
    o.value("amneziawg", "AmneziaWG");
  }
  o.value("block", "Block");
  o.value("exclusion", "Exclusion");

  o = section.option(
    form.ListValue,
    "proxy_config_type",
    _("Configuration Type"),
    _("Select how to configure the proxy"),
  );
  o.value("url", _("Connection URL"));
  o.value("selector", _("Selector"));
  o.value("urltest", _("URLTest"));
  o.value("outbound", _("Outbound Config"));
  o.value("endpoint", _("Endpoint Config"));
  o.default = "url";
  o.depends("connection_type", "proxy");

  o = section.option(
    form.TextValue,
    "proxy_string",
    _("Proxy Configuration URL"),
    _("vless://, ss://, trojan://, socks4/5://, hy2/hysteria2://, naive+https/quic:// links")
  );
  o.depends("proxy_config_type", "url");
  o.rows = 5;
  // Enable soft wrapping for multi-line proxy URLs (e.g., for URLTest proxy links)
  o.wrap = "soft";
  // Render as a textarea to allow multiple proxy URLs/configs
  o.textarea = true;
  o.rmempty = false;
  o.sectionDescriptions = new Map();
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateProxyUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.TextValue,
    "outbound_json",
    _("Outbound Configuration"),
    _("Enter complete outbound configuration in JSON format"),
  );
  o.depends("proxy_config_type", "outbound");
  o.rows = 10;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateOutboundJson(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.TextValue,
    "endpoint_json",
    _("Endpoint Configuration"),
    _(
      "Enter complete endpoint configuration in JSON format, e.g. a WireGuard endpoint. The tag is assigned by mudakop and will be overwritten",
    ),
  );
  o.depends("proxy_config_type", "endpoint");
  o.rows = 10;
  o.placeholder =
    '{\n  "type": "wireguard",\n  "system": false,\n  "address": ["172.16.0.2/32"],\n  "private_key": "",\n  "peers": [\n    {\n      "address": "127.0.0.1",\n      "port": 51820,\n      "public_key": "",\n      "allowed_ips": ["0.0.0.0/0"]\n    }\n  ]\n}';
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateEndpointJson(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  // ---------------------------------------------------------------- AmneziaWG
  // The whole tunnel lives in a modal: a couple of dozen inline options would bury the
  // rest of the section form, and the fields only ever apply to this one type
  o = section.option(form.DummyValue, "_awg_summary", _("AmneziaWG Tunnel"));
  o.depends("connection_type", "amneziawg");
  o.cfgvalue = function (section_id) {
    const peer = uci.get("mudakop", section_id, "awg_peer_address");
    const port = uci.get("mudakop", section_id, "awg_peer_port");

    if (!peer) {
      return _("Not configured yet");
    }

    return port ? "%s:%s".format(peer, port) : peer;
  };

  o = section.option(form.Button, "_awg_configure", " ");
  o.depends("connection_type", "amneziawg");
  o.inputtitle = _("Configure AmneziaWG");
  o.inputstyle = "apply";
  o.description = _(
    "Edit the tunnel, or import an AmneziaWG .conf. A .conf carries I1-I5 junk packets; the id/ip/ib generator has no .conf equivalent and is entered by hand",
  );
  o.onclick = function (ev, section_id) {
    showAmneziaWgModal(this.map, section_id);
  };

  // --------------------------------------------------------------- subscriptions
  // The links themselves still live in the selector/urltest lists, so nothing on the
  // router side has to know about subscriptions: importing is only a way of filling
  // those lists without pasting a few dozen links by hand
  o = section.option(
    form.Value,
    "subscription_url",
    _("Subscription URL"),
    _("An https:// link to a subscription. Importing fetches it through the router and offers its servers for the list below"),
  );
  o.depends("proxy_config_type", "selector");
  o.depends("proxy_config_type", "urltest");
  o.placeholder = "https://example.com/subscription";
  o.rmempty = true;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    if (!/^https?:\/\//i.test(value)) {
      return _("Subscription URL must start with http:// or https://");
    }

    const validation = main.validateUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(form.DummyValue, "_subscription_status", _("Subscription"));
  o.depends("proxy_config_type", "selector");
  o.depends("proxy_config_type", "urltest");
  o.cfgvalue = function (section_id) {
    return subscriptionStatusText(section_id);
  };

  o = section.option(form.Button, "_subscription_import", " ");
  o.depends("proxy_config_type", "selector");
  o.depends("proxy_config_type", "urltest");
  o.inputtitle = _("Import subscription");
  o.inputstyle = "apply";
  o.description = _(
    "Only the protocols mudakop supports are offered: vless, ss, trojan, socks4/5, hysteria2 and naive. Base64 and plain text subscriptions are both understood",
  );
  o.onclick = function (ev, section_id) {
    showSubscriptionModal(this.map, section_id);
  };

  o = section.option(
    form.Flag,
    "subscription_auto_update",
    _("Auto Update Subscription"),
    _("Refresh this subscription on a schedule: new servers are added, retired ones are removed, and servers you delete from the list below stay deleted. The interval is set in Settings"),
  );
  o.depends("proxy_config_type", "selector");
  o.depends("proxy_config_type", "urltest");
  o.default = "0";
  o.rmempty = false;

  o = section.option(
    form.DynamicList,
    "selector_proxy_links",
    _("Selector Proxy Links"),
    _("vless://, ss://, trojan://, socks4/5://, hy2/hysteria2://, naive+https/quic:// links")
  );
  o.depends("proxy_config_type", "selector");
  o.rmempty = false;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateProxyUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "urltest_proxy_links",
    _("URLTest Proxy Links"),
    _("vless://, ss://, trojan://, socks4/5://, hy2/hysteria2://, naive+https/quic:// links")
  );
  o.depends("proxy_config_type", "urltest");
  o.rmempty = false;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateProxyUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.ListValue,
    "urltest_check_interval",
    _("URLTest Check Interval"),
    _("The interval between connectivity tests")
  );
  o.value("30s", _("Every 30 seconds"));
  o.value("1m", _("Every 1 minute"));
  o.value("3m", _("Every 3 minutes"));
  o.value("5m", _("Every 5 minutes"));
  o.default = "3m";
  o.depends("proxy_config_type", "urltest");

  o = section.option(
    form.Value,
    "urltest_tolerance",
    _("URLTest Tolerance"),
    _("The maximum difference in response times (ms) allowed when comparing servers")
  );
  o.default = "50";
  o.rmempty = false;
  o.depends("proxy_config_type", "urltest");
  o.validate = function (section_id, value) {
    if (!value || value.length === 0) {
      return true;
    }

    const parsed = parseFloat(value);

    if (/^[0-9]+$/.test(value) && !isNaN(parsed) && isFinite(parsed) && parsed >= 50 && parsed <= 1000) {
      return true;
    }

    return _('Must be a number in the range of 50 - 1000');
  };

  o = section.option(
    form.Value,
    "urltest_testing_url",
    _("URLTest Testing URL"),
    _("The URL used to test server connectivity")
  );
  o.value("https://www.gstatic.com/generate_204", "https://www.gstatic.com/generate_204 (Google)");
  o.value("https://cp.cloudflare.com/generate_204", "https://cp.cloudflare.com/generate_204 (Cloudflare)");
  o.value("https://captive.apple.com", "https://captive.apple.com (Apple)");
  o.value("https://connectivity-check.ubuntu.com", "https://connectivity-check.ubuntu.com (Ubuntu)")
  o.default = "https://www.gstatic.com/generate_204";
  o.rmempty = false;
  o.depends("proxy_config_type", "urltest");

  o.validate = function (section_id, value) {
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.Flag,
    "enable_udp_over_tcp",
    _("UDP over TCP"),
    _("Applicable for SOCKS and Shadowsocks proxy"),
  );
  o.default = "0";
  // Only the link-based config types build their outbound through
  // sing_box_cf_add_proxy_outbound, which is what consumes this flag. The raw JSON
  // outbound and the layer-3 endpoint types ignore it entirely
  o.depends({ connection_type: "proxy", proxy_config_type: "url" });
  o.depends({ connection_type: "proxy", proxy_config_type: "selector" });
  o.depends({ connection_type: "proxy", proxy_config_type: "urltest" });
  o.rmempty = false;

  o = section.option(
    widgets.DeviceSelect,
    "interface",
    _("Network Interface"),
    _("Select network interface for VPN connection"),
  );
  o.depends("connection_type", "vpn");
  o.noaliases = true;
  o.nobridges = false;
  o.noinactive = false;
  o.filter = function (section_id, value) {
    // Blocked interface names that should never be selectable
    const blockedInterfaces = [
      "br-lan",
      "eth0",
      "eth1",
      "wan",
      "phy0-ap0",
      "phy1-ap0",
      "pppoe-wan",
      "lan",
    ];

    // Reject immediately if the value matches any blocked interface
    if (blockedInterfaces.includes(value)) {
      return false;
    }

    // Try to find the device object with the given name
    const device = this.devices.find((dev) => dev.getName() === value);

    // If no device is found, allow the value
    if (!device) {
      return true;
    }

    // Get the device type (e.g., "wifi", "ethernet", etc.)
    const type = device.getType();

    // Reject wireless-related devices
    const isWireless =
      type === "wifi" || type === "wireless" || type.includes("wlan");

    return !isWireless;
  };

  o = section.option(
    form.Flag,
    "domain_resolver_enabled",
    _("Domain Resolver"),
    _("Enable built-in DNS resolver for domains handled by this section"),
  );
  o.default = "0";
  o.rmempty = false;
  o.depends("connection_type", "vpn");
  // Endpoints are layer 3 like a VPN interface, so they resolve destinations locally.
  // The proxy protocols pass the domain to the remote server and need no resolver here
  o.depends({ connection_type: "proxy", proxy_config_type: "endpoint" });
  o.depends("connection_type", "amneziawg");

  o = section.option(
    form.ListValue,
    "domain_resolver_dns_type",
    _("DNS Protocol Type"),
    _("Select the DNS protocol type for the domain resolver"),
  );
  o.value("doh", _("DNS over HTTPS (DoH)"));
  o.value("dot", _("DNS over TLS (DoT)"));
  o.value("udp", _("UDP (Unprotected DNS)"));
  o.default = "udp";
  o.rmempty = false;
  o.depends("domain_resolver_enabled", "1");

  o = section.option(
    form.Value,
    "domain_resolver_dns_server",
    _("DNS Server"),
    _("Select or enter DNS server address"),
  );
  Object.entries(main.DNS_SERVER_OPTIONS).forEach(([key, label]) => {
    o.value(key, _(label));
  });
  o.default = "8.8.8.8";
  o.rmempty = false;
  o.depends("domain_resolver_enabled", "1");
  o.validate = function (section_id, value) {
    const validation = main.validateDNS(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.ListValue,
    "user_domain_list_type",
    _("User Domain List Type"),
    _("Select the list type for adding custom domains"),
  );
  o.value("disabled", _("Disabled"));
  o.value("dynamic", _("Dynamic List"));
  o.value("text", _("Text List"));
  o.default = "disabled";
  o.rmempty = false;

  o = section.option(
    form.DynamicList,
    "user_domains",
    _("User Domains"),
    _(
      "Enter domain names without protocols, e.g. example.com or sub.example.com",
    ),
  );
  o.placeholder = "Domains list";
  o.depends("user_domain_list_type", "dynamic");
  o.rmempty = false;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateDomain(value, true);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.TextValue,
    "user_domains_text",
    _("User Domains List"),
    _(
      "Enter domain names separated by commas, spaces, or newlines. You can add comments using //",
    ),
  );
  o.placeholder =
    "example.com, sub.example.com\n// Social networks\ndomain.com test.com // personal domains";
  o.depends("user_domain_list_type", "text");
  o.rows = 8;
  o.rmempty = false;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const domains = main.parseValueList(value);

    if (!domains.length) {
      return _(
        "At least one valid domain must be specified. Comments-only content is not allowed.",
      );
    }

    const { valid, results } = main.bulkValidate(domains, (row) =>
      main.validateDomain(row, true),
    );

    if (!valid) {
      const errors = results
        .filter((validation) => !validation.valid) // Leave only failed validations
        .map((validation) => `${validation.value}: ${validation.message}`); // Collect validation errors

      return [_("Validation errors:"), ...errors].join("\n");
    }

    return true;
  };

  o = section.option(
    form.ListValue,
    "user_subnet_list_type",
    _("User Subnet List Type"),
    _("Select the list type for adding custom subnets"),
  );
  o.value("disabled", _("Disabled"));
  o.value("dynamic", _("Dynamic List"));
  o.value("text", _("Text List"));
  o.default = "disabled";
  o.rmempty = false;

  o = section.option(
    form.DynamicList,
    "user_subnets",
    _("User Subnets"),
    _(
      "Enter subnets in CIDR notation (e.g. 103.21.244.0/22 or 2001:db8::/32) or single IP addresses. IPv6 entries are only routed when IPv6 support is enabled in the settings",
    ),
  );
  o.placeholder = "IP or subnet";
  o.depends("user_subnet_list_type", "dynamic");
  o.rmempty = false;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateSubnet(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.TextValue,
    "user_subnets_text",
    _("User Subnets List"),
    _(
      "Enter subnets in CIDR notation or single IP addresses, separated by commas, spaces, or newlines. IPv6 entries are only routed when IPv6 support is enabled in the settings. You can add comments using //",
    ),
  );
  o.placeholder =
    "103.21.244.0/22\n// Google DNS\n8.8.8.8\n1.1.1.1/32, 9.9.9.9 // Cloudflare and Quad9\n2001:4860:4860::8888";
  o.depends("user_subnet_list_type", "text");
  o.rows = 10;
  o.rmempty = false;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const subnets = main.parseValueList(value);

    if (!subnets.length) {
      return _(
        "At least one valid subnet or IP must be specified. Comments-only content is not allowed.",
      );
    }

    const { valid, results } = main.bulkValidate(subnets, main.validateSubnet);

    if (!valid) {
      const errors = results
        .filter((validation) => !validation.valid) // Leave only failed validations
        .map((validation) => `${validation.value}: ${validation.message}`); // Collect validation errors

      return [_("Validation errors:"), ...errors].join("\n");
    }

    return true;
  };

  o = section.option(
    form.DynamicList,
    "local_domain_lists",
    _("Local Domain Lists"),
    _("Specify the path to the list file located on the router filesystem"),
  );
  o.placeholder = "/path/file.lst";
  o.rmempty = true;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validatePath(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "local_subnet_lists",
    _("Local Subnet Lists"),
    _("Specify the path to the list file located on the router filesystem"),
  );
  o.placeholder = "/path/file.lst";
  o.rmempty = true;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validatePath(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "remote_domain_lists",
    _("Remote Domain Lists"),
    _("Specify remote URLs to download and use domain lists"),
  );
  o.placeholder = "https://example.com/domains.srs";
  o.rmempty = true;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "remote_subnet_lists",
    _("Remote Subnet Lists"),
    _("Specify remote URLs to download and use subnet lists"),
  );
  o.placeholder = "https://example.com/subnets.srs";
  o.rmempty = true;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "fully_routed_macs",
    _("Fully Routed Devices"),
    _(
      "Pick devices by MAC address to send all of their traffic through this section, whatever IP address they get. Exclusion and block sections still apply to them",
    ),
  );
  o.placeholder = "aa:bb:cc:dd:ee:ff";
  o.rmempty = true;
  hostHintsToMacChoices(hostHints).forEach(([mac, label]) => o.value(mac, label));
  o.depends("connection_type", "proxy");
  o.depends("connection_type", "vpn");
  o.depends("connection_type", "amneziawg");
  o.validate = function (section_id, value) {
    if (!value || value.length === 0 || MAC_REGEX.test(value)) {
      return true;
    }

    return _("Invalid MAC address");
  };
  o.write = function (section_id, value) {
    const list = (Array.isArray(value) ? value : [value]).map((v) =>
      String(v).toLowerCase(),
    );

    return this.super("write", [section_id, list]);
  };

  o = section.option(
    form.DynamicList,
    "fully_routed_ips",
    _("Fully Routed IPs"),
    _(
      "Specify local IP addresses or subnets whose traffic will always be routed through the configured route. IPv6 entries are only routed when IPv6 support is enabled in the settings",
    ),
  );
  o.placeholder = "192.168.1.2, 192.168.1.0/24 or fd00::/64";
  o.rmempty = true;
  // Known devices show up as a dropdown; a custom address or subnet can still be typed
  hostHintsToChoices(hostHints).forEach(([addr, label]) => o.value(addr, label));
  o.depends("connection_type", "proxy");
  o.depends("connection_type", "vpn");
  o.depends("connection_type", "amneziawg");
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateSubnet(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.Flag,
    "tunnel_ipv6",
    _("Tunnel Carries IPv6"),
    _(
      "Turn on only if this tunnel has working IPv6. When off, sites are reached through it over IPv4 only, and IPv6 connections of fully routed devices are refused so they switch to IPv4 at once instead of hanging. Only matters when IPv6 support is enabled in the settings",
    ),
  );
  o.default = "0";
  o.rmempty = false;
  o.depends("connection_type", "proxy");
  o.depends("connection_type", "vpn");
  o.depends("connection_type", "amneziawg");

  o = section.option(
    form.Flag,
    "mixed_proxy_enabled",
    _("Enable Mixed Proxy"),
    _(
      "Enable the mixed proxy, allowing this section to route traffic through both HTTP and SOCKS proxies",
    ),
  );
  o.default = "0";
  o.rmempty = false;
  o.depends("connection_type", "proxy");
  o.depends("connection_type", "vpn");
  o.depends("connection_type", "amneziawg");

  o = section.option(
    form.Value,
    "mixed_proxy_port",
    _("Mixed Proxy Port"),
    _(
      "Specify the port number on which the mixed proxy will run for this section. " +
        "Make sure the selected port is not used by another service",
    ),
  );
  o.rmempty = false;
  o.depends("mixed_proxy_enabled", "1");

  o = section.option(
    form.Flag,
    "resolve_real_ip_for_routing",
    _("Resolve real IP for routing"),
    _("Enable DNS resolve to get real IP when routing"),
  );
  o.default = "0";
  o.rmempty = false;
  o.depends("connection_type", "proxy");
  o.depends("connection_type", "vpn");
  o.depends("connection_type", "amneziawg");

  o = section.option(
    form.Flag,
    "disable_quic",
    _("Disable QUIC"),
    _(
      "Disable the QUIC protocol for this section's traffic only. The global Disable QUIC setting still applies to everything when enabled",
    ),
  );
  o.default = "0";
  o.rmempty = false;
  o.depends("connection_type", "proxy");
  o.depends("connection_type", "vpn");
  o.depends("connection_type", "amneziawg");

  // The rows only exist once the section has rendered, and LuCI re-renders the whole
  // map on save, add and remove, so the grouping is reapplied on every render
  const renderSection = section.render.bind(section);
  section.render = function () {
    return Promise.resolve(renderSection.apply(null, arguments)).then((node) => {
      try {
        applyCollapsibleLayout(node);
      } catch (e) {
        // A failed grouping must not cost the user the form itself
        console.error("Failed to build collapsible groups:", e);
      }

      return node;
    });
  };
}

const EntryPoint = {
  createSectionContent,
};

return baseclass.extend(EntryPoint);
