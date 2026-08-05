include $(TOPDIR)/rules.mk

PKG_NAME:=mudakop

PKG_VERSION := $(if $(MUDAKOP_VERSION),$(MUDAKOP_VERSION),0.$(shell date +%d%m%Y))

# apk and opkg order on PKG_RELEASE, which is what makes successive builds upgradeable
PKG_RELEASE := $(if $(MUDAKOP_RELEASE),$(MUDAKOP_RELEASE),1)

PKG_MAINTAINER:=nousernameforu <nousernameforu@users.noreply.github.com>
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/mudakop
	SECTION:=net
	CATEGORY:=Network
	DEPENDS:=+sing-box +curl +jq +kmod-nft-tproxy +coreutils-base64 +bind-dig
	CONFLICTS:=https-dns-proxy nextdns luci-app-passwall luci-app-passwall2
	TITLE:=Domain routing app
	URL:=https://github.com/nousernameforu/mudakop
	PKGARCH:=all
endef

define Package/mudakop/description
	Domain routing. Use of VLESS, Shadowsocks technologies
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/mudakop/prerm
#!/bin/sh

grep -q "105 mudakop" /etc/iproute2/rt_tables && sed -i "/105 mudakop/d" /etc/iproute2/rt_tables

/etc/init.d/mudakop stop

exit 0
endef

define Package/mudakop/conffiles
/etc/config/mudakop
endef

define Package/mudakop/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/mudakop $(1)/etc/init.d/mudakop

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/mudakop $(1)/etc/config/mudakop

	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/mudakop $(1)/usr/bin/mudakop

	$(INSTALL_DIR) $(1)/usr/lib/mudakop
	$(CP) ./files/usr/lib/* $(1)/usr/lib/mudakop/

	sed -i -e 's/__COMPILED_VERSION_VARIABLE__/$(PKG_VERSION)/g' $(1)/usr/lib/mudakop/constants.sh
endef

$(eval $(call BuildPackage,mudakop))
