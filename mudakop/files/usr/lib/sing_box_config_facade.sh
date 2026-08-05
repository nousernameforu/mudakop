mudakop_LIB="/usr/lib/mudakop"
. "$mudakop_LIB/helpers.sh"
. "$mudakop_LIB/sing_box_config_manager.sh"

sing_box_cf_add_dns_server() {
    local config="$1"
    local type="$2"
    local tag="$3"
    local server="$4"
    local domain_resolver="$5"
    local detour="$6"

    local server_address server_port
    server_address=$(url_get_host "$server")
    server_port=$(url_get_port "$server")

    case "$type" in
    udp)
        [ -z "$server_port" ] && server_port=53
        config=$(sing_box_cm_add_udp_dns_server "$config" "$tag" "$server_address" "$server_port" "$domain_resolver" \
            "$detour")
        ;;
    dot)
        [ -z "$server_port" ] && server_port=853
        config=$(sing_box_cm_add_tls_dns_server "$config" "$tag" "$server_address" "$server_port" "$domain_resolver" \
            "$detour")
        ;;
    doh)
        [ -z "$server_port" ] && server_port=443
        local path headers
        path=$(url_get_path "$server")
        headers="" # TODO(ampetelin): implement it if necessary
        config=$(sing_box_cm_add_https_dns_server "$config" "$tag" "$server_address" "$server_port" "$path" "$headers" \
            "$domain_resolver" "$detour")
        ;;
    *)
        log "Unsupported DNS server type: $type. Aborted." "fatal"
        exit 1
        ;;
    esac

    echo "$config"
}

sing_box_cf_add_mixed_inbound_and_route_rule() {
    local config="$1"
    local tag="$2"
    local listen_address="$3"
    local listen_port="$4"
    local outbound="$5"

    config=$(sing_box_cm_add_mixed_inbound "$config" "$tag" "$listen_address" "$listen_port")
    config=$(sing_box_cm_add_route_rule "$config" "" "$tag" "$outbound")

    echo "$config"
}

sing_box_cf_add_proxy_outbound() {
    local config="$1"
    local section="$2"
    local url="$3"
    local udp_over_tcp="$4"

    # Kept undecoded for parameters whose decoded form would break the line-based
    # extraction in url_get_query_param, such as the CRLF-separated extra-headers
    local raw_url="$url"

    # url_decode treats "+" as a form-encoded space, which would turn the "naive+https"
    # scheme into "naive https". Take the scheme from the raw URL and decode only the
    # remainder. Every other scheme is plain ASCII, so decoding was a no-op for them
    local scheme
    scheme="$(url_get_scheme "$url")"

    url="$scheme://$(url_decode "${url#*://}")"
    url=$(url_strip_fragment "$url")

    case "$scheme" in
    socks4 | socks4a | socks5)
        local tag host port version userinfo username password udp_over_tcp

        tag=$(get_outbound_tag_by_section "$section")
        host=$(url_get_host "$url")
        port=$(url_get_port "$url")
        version="${scheme#socks}"
        if [ "$scheme" = "socks5" ]; then
            userinfo=$(url_get_userinfo "$url")
            if [ -n "$userinfo" ]; then
                username="${userinfo%%:*}"
                password="${userinfo#*:}"
            fi
        fi
        config="$(sing_box_cm_add_socks_outbound \
            "$config" \
            "$tag" \
            "$host" \
            "$port" \
            "$version" \
            "$username" \
            "$password" \
            "" \
            "$([ "$udp_over_tcp" == "1" ] && echo 2)" # if udp_over_tcp is enabled, enable version 2
        )"
        ;;
    vless)
        local tag host port uuid flow packet_encoding
        tag=$(get_outbound_tag_by_section "$section")
        host=$(url_get_host "$url")
        port=$(url_get_port "$url")
        uuid=$(url_get_userinfo "$url")
        flow=$(url_get_query_param "$url" "flow")
        packet_encoding=$(url_get_query_param "$url" "packetEncoding")

        config=$(sing_box_cm_add_vless_outbound "$config" "$tag" "$host" "$port" "$uuid" "$flow" "" "$packet_encoding")
        config=$(_add_outbound_security "$config" "$tag" "$url")
        config=$(_add_outbound_transport "$config" "$tag" "$url")
        ;;
    ss)
        local userinfo tag host port method password udp_over_tcp

        userinfo=$(url_get_userinfo "$url")
        if ! is_shadowsocks_userinfo_format "$userinfo"; then
            userinfo=$(base64_decode "$userinfo")
            if [ $? -ne 0 ]; then
                log "Cannot decode shadowsocks userinfo or it does not match the expected format. Aborted." "fatal"
                exit 1
            fi
        fi

        tag=$(get_outbound_tag_by_section "$section")
        host=$(url_get_host "$url")
        port=$(url_get_port "$url")
        method="${userinfo%%:*}"
        password="${userinfo#*:}"

        config=$(
            sing_box_cm_add_shadowsocks_outbound \
                "$config" \
                "$tag" \
                "$host" \
                "$port" \
                "$method" \
                "$password" \
                "" \
                "$([ "$udp_over_tcp" == "1" ] && echo 2)" # if udp_over_tcp is enabled, enable version 2
        )
        ;;
    trojan)
        local tag host port password
        tag=$(get_outbound_tag_by_section "$section")
        host=$(url_get_host "$url")
        port=$(url_get_port "$url")
        password=$(url_get_userinfo "$url")

        config=$(sing_box_cm_add_trojan_outbound "$config" "$tag" "$host" "$port" "$password")
        config=$(_add_outbound_security "$config" "$tag" "$url")
        config=$(_add_outbound_transport "$config" "$tag" "$url")
        ;;
    naive+https | naive+quic)
        local tag host port userinfo username password server_name insecure quic extra_headers

        if ! sing_box_has_build_tag "with_naive_outbound"; then
            log "The installed sing-box was built without the with_naive_outbound tag, so naive:// outbounds are unsupported. Install a build that includes it, for example sing-box-lx." "fatal"
            exit 1
        fi

        tag=$(get_outbound_tag_by_section "$section")
        host=$(url_get_host "$url")
        port=$(url_get_port "$url")
        # The NaiveProxy URI spec defaults the port to 443
        [ -z "$port" ] && port=443

        userinfo=$(url_get_userinfo "$url")
        if [ -n "$userinfo" ]; then
            username="${userinfo%%:*}"
            case "$userinfo" in
            *:*) password="${userinfo#*:}" ;;
            esac
        fi

        # naive+quic selects HTTP/3; naive+https is HTTP/2 and is sing-box's default
        [ "$scheme" = "naive+quic" ] && quic=true

        # sni is the V2Ray-style spelling emitted by NekoBox and friends. The naive URI
        # spec has no SNI parameter, so nothing else needs checking here
        server_name=$(url_get_query_param "$url" "sni")
        insecure=$(_get_insecure_query_param_from_url "$url")

        extra_headers=$(_naive_extra_headers_to_json "$(url_get_query_param "$raw_url" "extra-headers")")

        config="$(sing_box_cm_add_naive_outbound \
            "$config" \
            "$tag" \
            "$host" \
            "$port" \
            "$username" \
            "$password" \
            "$server_name" \
            "$([ "$insecure" = "1" ] && echo true)" \
            "$quic" \
            "$extra_headers" \
            "$([ "$udp_over_tcp" = "1" ] && echo 2)" # if udp_over_tcp is enabled, enable version 2
        )"
        ;;
    hysteria2 | hy2)
        local tag host port password obfuscator_type obfuscator_password upload_mbps download_mbps
        tag=$(get_outbound_tag_by_section "$section")
        host=$(url_get_host "$url")
        port="$(url_get_port "$url")"
        password=$(url_get_userinfo "$url")
        obfuscator_type=$(url_get_query_param "$url" "obfs")
        obfuscator_password=$(url_get_query_param "$url" "obfs-password")
        upload_mbps=$(url_get_query_param "$url" "upmbps")
        download_mbps=$(url_get_query_param "$url" "downmbps")

        config=$(sing_box_cm_add_hysteria2_outbound "$config" "$tag" "$host" "$port" "$password" "$obfuscator_type" \
            "$obfuscator_password" "$upload_mbps" "$download_mbps")
        config=$(_add_outbound_security "$config" "$tag" "$url")
        ;;
    *)
        log "Unsupported proxy $scheme type. Aborted." "fatal"
        exit 1
        ;;
    esac

    echo "$config"
}

_add_outbound_security() {
    local config="$1"
    local outbound_tag="$2"
    local url="$3"

    local security scheme
    security=$(url_get_query_param "$url" "security")
    scheme="$(url_get_scheme "$url")"

    if [ -z "$security" ]; then
        if [ "$scheme" = "hysteria2" ] || [ "$scheme" = "hy2" ]; then
            security="tls"
        fi
    fi

    case "$security" in
    tls | reality)
        local sni insecure alpn fingerprint public_key short_id
        sni=$(url_get_query_param "$url" "sni")
        insecure=$(_get_insecure_query_param_from_url "$url")
        alpn=$(comma_string_to_json_array "$(url_get_query_param "$url" "alpn")")
        fingerprint=$(url_get_query_param "$url" "fp")
        public_key=$(url_get_query_param "$url" "pbk")
        short_id=$(url_get_query_param "$url" "sid")

        if [ "$scheme" = "hysteria2" ] || [ "$scheme" = "hy2" ]; then
                fingerprint=""
        fi

        config=$(
            sing_box_cm_set_tls_for_outbound \
                "$config" \
                "$outbound_tag" \
                "$sni" \
                "$([ "$insecure" == "1" ] && echo true)" \
                "$([ "$alpn" == "[]" ] && echo null || echo "$alpn")" \
                "$fingerprint" \
                "$public_key" \
                "$short_id"
        )
        ;;
    none) ;;
    *)
        log "Unknown security '$security' detected." "error"
        ;;
    esac

    echo "$config"
}

#######################################
# Converts the NaiveProxy URI "extra-headers" parameter into a JSON object.
# The spec encodes it with encodeURIComponent as "HEADER: VALUE" pairs joined by CRLF.
# Arguments:
#   raw: string, the still percent-encoded parameter value
# Outputs:
#   Writes a JSON object to stdout, "{}" when empty or unparseable
#######################################
_naive_extra_headers_to_json() {
    local raw="$1"

    if [ -z "$raw" ]; then
        echo "{}"
        return
    fi

    local decoded json
    decoded=$(url_decode "$raw")

    json=$(printf '%s' "$decoded" | jq -R -s '
        gsub("\r\n"; "\n")
        | split("\n")
        | map(select(test("^[^:]+:")))
        | map(
            (index(":")) as $i
            | {
                (.[0:$i] | sub("^ +"; "") | sub(" +$"; "")):
                (.[$i + 1:] | sub("^ +"; "") | sub(" +$"; ""))
              }
          )
        | add // {}
    ' 2> /dev/null)

    if [ -z "$json" ]; then
        log "Could not parse the extra-headers parameter, ignoring it" "warn"
        echo "{}"
        return
    fi

    echo "$json"
}

_get_insecure_query_param_from_url() {
    local url="$1"

    local insecure
    insecure=$(url_get_query_param "$url" "allowInsecure")
    if [ -z "$insecure" ]; then
        insecure=$(url_get_query_param "$url" "insecure")
    fi

    echo "$insecure"
}

_add_outbound_transport() {
    local config="$1"
    local outbound_tag="$2"
    local url="$3"

    local transport
    transport=$(url_get_query_param "$url" "type")
    case "$transport" in
    tcp | raw) ;;
    ws)
        local ws_path ws_host ws_early_data
        ws_path=$(url_get_query_param "$url" "path")
        ws_host=$(url_get_query_param "$url" "host")
        ws_early_data=$(url_get_query_param "$url" "ed")

        config=$(
            sing_box_cm_set_ws_transport_for_outbound "$config" "$outbound_tag" "$ws_path" "$ws_host" "$ws_early_data"
        )
        ;;
    grpc)
        # TODO(ampetelin): Add handling of optional gRPC parameters; example links are needed.
        local grpc_service_name
        grpc_service_name=$(url_get_query_param "$url" "serviceName")

        config=$(
            sing_box_cm_set_grpc_transport_for_outbound "$config" "$outbound_tag" "$grpc_service_name"
        )
        ;;
    *)
        log "Unknown transport '$transport' detected." "error"
        ;;
    esac

    echo "$config"
}

sing_box_cf_add_json_outbound() {
    local config="$1"
    local section="$2"
    local json_outbound="$3"

    local tag
    tag=$(get_outbound_tag_by_section "$section")

    config=$(sing_box_cm_add_raw_outbound "$config" "$tag" "$json_outbound")

    echo "$config"
}

sing_box_cf_add_json_endpoint() {
    local config="$1"
    local section="$2"
    local json_endpoint="$3"

    local tag
    tag=$(get_outbound_tag_by_section "$section")

    config=$(sing_box_cm_add_raw_endpoint "$config" "$tag" "$json_endpoint")

    echo "$config"
}

sing_box_cf_add_interface_outbound() {
    local config="$1"
    local section="$2"
    local interface_name="$3"

    local tag
    tag=$(get_outbound_tag_by_section "$section")

    config=$(sing_box_cm_add_interface_outbound "$config" "$tag" "$interface_name")

    echo "$config"
}

sing_box_cf_proxy_domain() {
    local config="$1"
    local inbound="$2"
    local domain="$3"
    local outbound="$4"

    tag="$(gen_id)"
    config=$(sing_box_cm_add_route_rule "$config" "$tag" "$inbound" "$outbound")
    config=$(sing_box_cm_patch_route_rule "$config" "$tag" "domain" "$domain")

    echo "$config"
}

sing_box_cf_override_domain_port() {
    local config="$1"
    local domain="$2"
    local port="$3"

    tag="$(gen_id)"
    config=$(sing_box_cm_add_options_route_rule "$config" "$tag")
    config=$(sing_box_cm_patch_route_rule "$config" "$tag" "domain" "$domain")
    config=$(sing_box_cm_patch_route_rule "$config" "$tag" "override_port" "$port")

    echo "$config"
}

sing_box_cf_add_single_key_reject_rule() {
    local config="$1"
    local inbound="$2"
    local key="$3"
    local value="$4"

    tag="$(gen_id)"
    config=$(sing_box_cm_add_reject_route_rule "$config" "$tag" "$inbound")
    config=$(sing_box_cm_patch_route_rule "$config" "$tag" "$key" "$value")

    echo "$config"
}
