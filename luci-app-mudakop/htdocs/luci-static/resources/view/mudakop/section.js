"use strict";
"require form";
"require baseclass";
"require ui";
"require uci";
"require tools.widgets as widgets";
"require view.mudakop.main as main";

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

function createSectionContent(section, options = {}) {
  const { amneziaWgAvailable = false } = options;

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
    "fully_routed_ips",
    _("Fully Routed IPs"),
    _(
      "Specify local IP addresses or subnets whose traffic will always be routed through the configured route. IPv6 entries are only routed when IPv6 support is enabled in the settings",
    ),
  );
  o.placeholder = "192.168.1.2, 192.168.1.0/24 or fd00::/64";
  o.rmempty = true;
  o.depends("connection_type", "proxy");
  o.depends("connection_type", "vpn");
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
}

const EntryPoint = {
  createSectionContent,
};

return baseclass.extend(EntryPoint);
