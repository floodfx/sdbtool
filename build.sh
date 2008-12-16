#!/bin/bash

date

set -e

function get_dir_revision() {
    local pkg_release
    local last_rev

    # Generate a release number for the entire branch
    last_rev=$(svn info $1 2>&1 | grep 'Revision')
    pkg_release=${last_rev#Revision: }
    if [ -z "$pkg_release" ] ; then
    pkg_release=0
    fi
    # Left pad with zeroes to 6 columns
    printf "%04d" ${pkg_release}
}

function get_pkg_release() {
    get_dir_revision README
}

if [ `uname` == "Darwin" ]; then
    echo "+ Building on Darwin"
    export DARWIN=1
    export SED_ARGS="-i .bak"
else
    export SED_ARGS="-i"
fi

export PKG_VERSION=2008.12.15
export PKG_RELEASE=$(get_pkg_release)
export PKG_NAME=sdbizo
export BASE=$PKG_NAME-$PKG_VERSION.$PKG_RELEASE

echo "+ Bulding $PKG_NAME version $PKG_VERSION-$PKG_RELEASE"

# setup source for building
rm -rf build && mkdir -p build/$BASE
rsync -azC --exclude '*.swp' --exclude '*~' src/ README LICENSE build/$BASE/.

pushd build/$BASE > /dev/null
  # change from development manifest
  mv chrome.manifest.dist chrome.manifest
  for f in \
    chrome/content/sdbizo/*.xul \
    chrome/content/sdbizo/js/*.js \
    chrome/content/sdbizo/images/*.gif \
    *.rdf; do
    sed -e "s/__VERSION__/$PKG_VERSION/g" $SED_ARGS $f
    sed -e "s/__BUILD__/$PKG_RELEASE/g" $SED_ARGS $f
  done
  # remove sed backups, to get around stupidness with Darwin's sed
  find . -name \*.bak -exec rm -f \{} \;
popd > /dev/null

# make the chrome jar
pushd build/$BASE/chrome > /dev/null
  rm -f sdbizo.jar
  $JAVA_HOME/bin/jar cf sdbizo.jar content locale
popd > /dev/null

# prepare source for bundling
mkdir -p build/$BASE-src
rsync -azC LICENSE README *.sh src build/$BASE-src
