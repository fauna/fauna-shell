#!/bin/sh
# update the concourse pipeline with this script.

fly -t devex set-pipeline --pipeline fauna-shell-release --config concourse/pipeline.yml
