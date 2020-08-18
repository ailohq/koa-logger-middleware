#!/bin/sh

set -ex

yarn
yarn lint
yarn test
yarn build
