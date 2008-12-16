#!/bin/bash

rm -rf dist && mkdir dist

BASE=`basename build/*-*.*.*`

pushd build/$BASE > /dev/null 
  # package an xpi
  echo "+ Creating dist/$BASE.xpi"
  zip -9 ../../dist/$BASE.xpi install.* chrome.manifest chrome/sdbizo.jar README LICENSE

  cp README LICENSE ../../dist
popd > /dev/null

pushd dist > /dev/null
  # package the extension as a zip file
  echo "+ Creating dist/$BASE.zip"
  zip -9 $BASE.zip $BASE.xpi README LICENSE
popd > /dev/null

# create source tarball
echo "+ Creating dist/$BASE-src.tgz"
tar czf dist/$BASE-src.tgz -C build $BASE-src

# rdf describing updates, legacy naming to support old versions that
# still expect this rdf file
cp build/$BASE/sdbizo.rdf dist/sdbizo.rdf

