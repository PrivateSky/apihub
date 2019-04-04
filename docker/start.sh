#!/bin/bash
name="$(./util/name.sh -1)"

docker run --detach \
    --hostname localhost \
    --publish 9292:8080 \
    --name $name \
    --restart always \
    privatesky/virtual_mq
