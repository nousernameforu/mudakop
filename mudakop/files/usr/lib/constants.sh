# shellcheck disable=SC2034

MUDAKOP_VERSION="__COMPILED_VERSION_VARIABLE__"
## Common
MUDAKOP_CONFIG="/etc/config/mudakop"
RESOLV_CONF="/etc/resolv.conf"
DNS_RESOLVERS="1.1.1.1 1.0.0.1 8.8.8.8 8.8.4.4 9.9.9.9 9.9.9.11 94.140.14.14 94.140.15.15 208.67.220.220 208.67.222.222 77.88.8.1 77.88.8.8"
# FakeIP probe domains. Nothing is hosted behind them: they exist only to be added
# to the sing-box FakeIP domain list, so resolving one locally proves FakeIP synthesis
# works and connecting to one drives traffic through the nftables tproxy rules.
# Keep in sync with FAKEIP_CHECK_DOMAIN/IP_CHECK_DOMAIN in fe-app-mudakop/src/constants.ts
CHECK_PROXY_IP_DOMAIN="ip.mudakop.fyi"
FAKEIP_TEST_DOMAIN="fakeip.mudakop.fyi"
TMP_SING_BOX_FOLDER="/tmp/sing-box"
TMP_RULESET_FOLDER="$TMP_SING_BOX_FOLDER/rulesets"
CLOUDFLARE_OCTETS="8.47 162.159 188.114" # Endpoints https://github.com/ampetelin/warp-endpoint-checker
JQ_REQUIRED_VERSION="1.7.1"
COREUTILS_BASE64_REQUIRED_VERSION="9.7"
RT_TABLE_NAME="mudakop"

## nft
NFT_TABLE_NAME="mudakopTable"
NFT_LOCALV4_SET_NAME="localv4"
NFT_LOCALV6_SET_NAME="localv6"
NFT_COMMON_SET_NAME="mudakop_subnets"
NFT_COMMON_V6_SET_NAME="mudakop_subnets_v6"
NFT_DISCORD_SET_NAME="mudakop_discord_subnets"
NFT_INTERFACE_SET_NAME="interfaces"
NFT_FAKEIP_MARK="0x00100000"
NFT_OUTBOUND_MARK="0x00200000"

## sing-box
SB_REQUIRED_VERSION="1.12.0"
# DNS
SB_DNS_SERVER_TAG="dns-server"
SB_FAKEIP_DNS_SERVER_TAG="fakeip-server"
SB_FAKEIP_INET4_RANGE="198.18.0.0/15"
# fc00::/8 is the unassigned half of the ULA space (real ULAs live in fd00::/8),
# so this range does not collide with addresses handed out on the LAN.
# Keep it out of NFT_LOCALV6_SET_NAME, otherwise fake addresses are treated as local.
SB_FAKEIP_INET6_RANGE="fc00::/18"
SB_BOOTSTRAP_SERVER_TAG="bootstrap-dns-server"
SB_FAKEIP_DNS_RULE_TAG="fakeip-dns-rule-tag"
SB_INVERT_FAKEIP_DNS_RULE_TAG="invert-fakeip-dns-rule-tag"
# Inbounds
SB_TPROXY_INBOUND_TAG="tproxy-in"
SB_TPROXY_INBOUND_ADDRESS="127.0.0.1"
SB_TPROXY_INBOUND_PORT=1602
SB_TPROXY6_INBOUND_TAG="tproxy6-in"
SB_TPROXY6_INBOUND_ADDRESS="::1"
SB_TPROXY6_INBOUND_PORT=1602
SB_DNS_INBOUND_TAG="dns-in"
SB_DNS_INBOUND_ADDRESS="127.0.0.42"
SB_DNS_INBOUND_PORT=53
SB_SERVICE_MIXED_INBOUND_TAG="service-mixed-in"
SB_SERVICE_MIXED_INBOUND_ADDRESS="127.0.0.1"
SB_SERVICE_MIXED_INBOUND_PORT=4534
# Outbounds
SB_DIRECT_OUTBOUND_TAG="direct-out"
# Route
SB_REJECT_RULE_TAG="reject-rule-tag"
SB_EXCLUSION_RULE_TAG="exclusion-rule-tag"
# Experimental
SB_CLASH_API_CONTROLLER_PORT=9090

## Lists
GITHUB_RAW_URL="https://raw.githubusercontent.com/itdoginfo/allow-domains/main"
SRS_MAIN_URL="https://github.com/itdoginfo/allow-domains/releases/latest/download"
SUBNETS_TWITTER="${GITHUB_RAW_URL}/Subnets/IPv4/twitter.lst"
SUBNETS_META="${GITHUB_RAW_URL}/Subnets/IPv4/meta.lst"
SUBNETS_DISCORD="${GITHUB_RAW_URL}/Subnets/IPv4/discord.lst"
SUBNETS_ROBLOX="${GITHUB_RAW_URL}/Subnets/IPv4/roblox.lst"
SUBNETS_TELERAM="${GITHUB_RAW_URL}/Subnets/IPv4/telegram.lst"
SUBNETS_CLOUDFLARE="${GITHUB_RAW_URL}/Subnets/IPv4/cloudflare.lst"
SUBNETS_HETZNER="${GITHUB_RAW_URL}/Subnets/IPv4/hetzner.lst"
SUBNETS_OVH="${GITHUB_RAW_URL}/Subnets/IPv4/ovh.lst"
SUBNETS_DIGITALOCEAN="${GITHUB_RAW_URL}/Subnets/IPv4/digitalocean.lst"
SUBNETS_CLOUDFRONT="${GITHUB_RAW_URL}/Subnets/IPv4/cloudfront.lst"
COMMUNITY_SERVICES="russia_inside russia_outside ukraine_inside geoblock block porn news anime youtube hdrezka tiktok google_ai google_play hodca discord meta twitter cloudflare cloudfront digitalocean hetzner ovh telegram roblox"