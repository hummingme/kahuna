#!/bin/bash

function determine_target() {
    if [ $# -eq 0 ] || [ "$1" == "firefox" ]; then
        echo "firefox"
    elif [ "$1" == "chromium" ]; then
        echo "chromium"
    else
        >&2 echo "parameter has to be either firefox or chromium (default: firefox), got: $1"
        >&2 echo "using default: firefox"
        echo "firefox"
    fi;
}

function free_port() {
    echo $(comm -23 \
        <(seq 55555 55666) \
        <(ss -Htan | awk '{print $4}' | cut -d':' -f2 | sort -u) \
        | head -n 1)
}
