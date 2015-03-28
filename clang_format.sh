#!/usr/bin/env bash

# Copyright 2015 Robin Dietrich
# Licensed under the AGPLv3
#
# Wrapper script around clang-format
#
# Usage:
# ./clang_format.sh (style) (lines) (file)
#
# Example:
# ./clang_format.sh Google 1:9999999 test.cpp
# ./clang_format.sh "{key: value, ...}" 1:9999999 test.cpp

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
LINK="$DIR/clang_format"

# Try to link clang-format to ./
# We don't want to run the find step every time the script runs
if [ ! -e ${LINK} ]; then
    # Possible locations of clang-format
    cfpath=(
        "/usr/bin/clang-format"
        "/usr/local/bin/clang-format"
        "/usr/local/llvm34/bin/clang-format"
        "/usr/local/llvm35/bin/clang-format"
        "/usr/bin/clang-format-3.5"
    )

    # Try to find binary
    binary=""

    for path in "${cfpath[@]}"
    do
        if [ -e ${path} ]; then
            binary=${path}
        fi
    done

    if [ binary == "" ]; then
        exit 0
    else
        ln -s ${binary} ${LINK}
    fi
fi

# If we have clang-format, execute it
if [ -e ${LINK} ]; then
    ${LINK} -style="$1" $3
fi