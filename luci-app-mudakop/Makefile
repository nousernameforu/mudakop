include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-mudakop

PKG_VERSION := $(if $(MUDAKOP_VERSION),$(MUDAKOP_VERSION),0.$(shell date +%d%m%Y))

# Kept in step with mudakop/Makefile
PKG_RELEASE := $(if $(MUDAKOP_RELEASE),$(MUDAKOP_RELEASE),1)

LUCI_TITLE:=LuCI mudakop app
LUCI_DEPENDS:=+luci-base +mudakop
LUCI_PKGARCH:=all
LUCI_LANG.ru:=Русский (Russian)
LUCI_LANG.en:=English

PKG_LICENSE:=GPL-2.0-or-later
PKG_MAINTAINER:=nousernameforu <nousernameforu@users.noreply.github.com>

LUCI_LANGUAGES:=en ru

include $(TOPDIR)/feeds/luci/luci.mk

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)$(HTDOCS)
	$(CP) $(PKG_BUILD_DIR)/htdocs/* $(1)$(HTDOCS)/
	$(INSTALL_DIR) $(1)/
	$(CP) $(PKG_BUILD_DIR)/root/* $(1)/
	sed -i -e 's/__COMPILED_VERSION_VARIABLE__/$(PKG_VERSION)/g' $(1)$(HTDOCS)/luci-static/resources/view/mudakop/main.js || true
endef

$(eval $(call BuildPackage,$(PKG_NAME)))