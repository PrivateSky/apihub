#!/bin/bash
node "$(dirname $(readlink -f $0))/startVirtualMQ.js" "$@"