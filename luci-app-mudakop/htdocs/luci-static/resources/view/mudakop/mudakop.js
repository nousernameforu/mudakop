"use strict";
"require view";
"require form";
"require baseclass";
"require network";
"require view.mudakop.main as main";

// Settings content
"require view.mudakop.settings as settings";

// Sections content
"require view.mudakop.section as section";

// Dashboard content
"require view.mudakop.dashboard as dashboard";

// Diagnostic content
"require view.mudakop.diagnostic as diagnostic";

const EntryPoint = {
  async render() {
    main.injectGlobalStyles();

    const mudakopMap = new form.Map(
      "mudakop",
      _("mudakop Settings"),
      _("Configuration for mudakop service"),
    );
    // Enable tab views
    mudakopMap.tabbed = true;

    // Sections tab
    const sectionsSection = mudakopMap.section(
      form.TypedSection,
      "section",
      _("Sections"),
    );
    sectionsSection.anonymous = false;
    sectionsSection.addremove = true;
    sectionsSection.template = "cbi/simpleform";

    // Render section content
    section.createSectionContent(sectionsSection);

    // Settings tab
    const settingsSection = mudakopMap.section(
      form.TypedSection,
      "settings",
      _("Settings"),
    );
    settingsSection.anonymous = true;
    settingsSection.addremove = false;
    // Make it named [ config settings 'settings' ]
    settingsSection.cfgsections = function () {
      return ["settings"];
    };

    // Render settings content
    settings.createSettingsContent(settingsSection);

    // Diagnostic tab
    const diagnosticSection = mudakopMap.section(
      form.TypedSection,
      "diagnostic",
      _("Diagnostics"),
    );
    diagnosticSection.anonymous = true;
    diagnosticSection.addremove = false;
    diagnosticSection.cfgsections = function () {
      return ["diagnostic"];
    };

    // Render diagnostic content
    diagnostic.createDiagnosticContent(diagnosticSection);

    // Dashboard tab
    const dashboardSection = mudakopMap.section(
      form.TypedSection,
      "dashboard",
      _("Dashboard"),
    );
    dashboardSection.anonymous = true;
    dashboardSection.addremove = false;
    dashboardSection.cfgsections = function () {
      return ["dashboard"];
    };

    // Render dashboard content
    dashboard.createDashboardContent(dashboardSection);

    // Inject core service
    main.coreService();

    return mudakopMap.render();
  },
};

return view.extend(EntryPoint);
