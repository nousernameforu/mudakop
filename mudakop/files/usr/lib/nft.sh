# Create an nftables table in the inet family
nft_create_table() {
    local name="$1"

    nft add table inet "$name"
}

# Create a set within a table for storing IPv4 addresses
nft_create_ipv4_set() {
    local table="$1"
    local name="$2"

    nft add set inet "$table" "$name" '{ type ipv4_addr; flags interval; auto-merge; }'
}

# Create a set within a table for storing IPv6 addresses
nft_create_ipv6_set() {
    local table="$1"
    local name="$2"

    nft add set inet "$table" "$name" '{ type ipv6_addr; flags interval; auto-merge; }'
}

nft_create_ifname_set() {
    local table="$1"
    local name="$2"

    nft add set inet "$table" "$name" '{ type ifname; flags interval; }'
}

# Add one or more elements to a set
nft_add_set_elements() {
    local table="$1"
    local set="$2"
    local elements="$3"

    nft add element inet "$table" "$set" "{ $elements }"
}

#######################################
# Load IP addresses/CIDRs from a plain-text file into nft sets, in chunks.
# Entries are dispatched by address family: IPv4 goes to nft_set_name, IPv6 to
# nft_v6_set_name. IPv6 entries are skipped when nft_v6_set_name is empty or when
# IPv6 support is disabled.
# Arguments:
#   filepath: string, path to the plain-text list
#   nft_table_name: string, name of the nft table holding the sets
#   nft_set_name: string, name of the IPv4 set
#   nft_v6_set_name: string, name of the IPv6 set (optional)
#   chunk_size: integer, elements per nft call (optional, default 5000)
#######################################
nft_add_set_elements_from_file_chunked() {
    local filepath="$1"
    local nft_table_name="$2"
    local nft_set_name="$3"
    local nft_v6_set_name="$4"
    local chunk_size="${5:-5000}"

    local array count array6 count6
    count=0
    count6=0
    while IFS= read -r line; do
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

        [ -z "$line" ] && continue

        if is_ipv4_ip_or_ipv4_cidr "$line"; then
            if [ -z "$array" ]; then
                array="$line"
            else
                array="$array,$line"
            fi

            count=$((count + 1))

            if [ "$count" = "$chunk_size" ]; then
                log "Adding $count elements to nft set $nft_set_name" "debug"
                nft_add_set_elements "$nft_table_name" "$nft_set_name" "$array"
                array=""
                count=0
            fi

            continue
        fi

        if [ -n "$nft_v6_set_name" ] && ipv6_enabled && is_ipv6_ip_or_ipv6_cidr "$line"; then
            if [ -z "$array6" ]; then
                array6="$line"
            else
                array6="$array6,$line"
            fi

            count6=$((count6 + 1))

            if [ "$count6" = "$chunk_size" ]; then
                log "Adding $count6 elements to nft set $nft_v6_set_name" "debug"
                nft_add_set_elements "$nft_table_name" "$nft_v6_set_name" "$array6"
                array6=""
                count6=0
            fi

            continue
        fi

        log "'$line' is not an IP address or CIDR for an enabled address family" "debug"
    done < "$filepath"

    if [ -n "$array" ]; then
        log "Adding $count elements to nft set $nft_set_name" "debug"
        nft_add_set_elements "$nft_table_name" "$nft_set_name" "$array"
    fi

    if [ -n "$array6" ]; then
        log "Adding $count6 elements to nft set $nft_v6_set_name" "debug"
        nft_add_set_elements "$nft_table_name" "$nft_v6_set_name" "$array6"
    fi
}

#######################################
# Add a comma-separated list of IP addresses/CIDRs to the matching nft set for each
# address family. IPv6 entries are skipped when IPv6 support is disabled.
# Arguments:
#   table: string, name of the nft table holding the sets
#   set: string, name of the IPv4 set
#   v6_set: string, name of the IPv6 set
#   elements: string, comma-separated list of addresses/CIDRs
#######################################
nft_add_mixed_set_elements() {
    local table="$1"
    local set="$2"
    local v6_set="$3"
    local elements="$4"

    [ -z "$elements" ] && return 0

    local item v4_elements v6_elements
    local old_ifs="$IFS"
    IFS=','
    for item in $elements; do
        [ -z "$item" ] && continue

        if is_ipv4_ip_or_ipv4_cidr "$item"; then
            if [ -z "$v4_elements" ]; then
                v4_elements="$item"
            else
                v4_elements="$v4_elements,$item"
            fi
        elif [ -n "$v6_set" ] && ipv6_enabled && is_ipv6_ip_or_ipv6_cidr "$item"; then
            if [ -z "$v6_elements" ]; then
                v6_elements="$item"
            else
                v6_elements="$v6_elements,$item"
            fi
        fi
    done
    IFS="$old_ifs"

    [ -n "$v4_elements" ] && nft_add_set_elements "$table" "$set" "$v4_elements"
    [ -n "$v6_elements" ] && nft_add_set_elements "$table" "$v6_set" "$v6_elements"

    return 0
}