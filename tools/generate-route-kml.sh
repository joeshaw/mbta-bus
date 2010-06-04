#!/bin/bash

# Gross hacky script to generate a single-route KML file

big_kml_file=$1
bus_line=$2

cat > $bus_line.kml <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.1">
  <Document>
    <open>1</open>
EOF

xpath $big_kml_file "//Folder[name=\"Routes\"]/Folder[name=\"<b>$bus_line</b>\"]" >> $bus_line.kml

cat >> $bus_line.kml <<EOF
  </Document>
</kml>
EOF

xmllint $bus_line.kml >/dev/null

if [ $? != 0 ]; then
    echo "Invalid KML file generated"
    exit 1
fi

if [ $(grep -c Folder $bus_line.kml) -eq "0" ]; then
    echo "This bus line doesn't seem to appear in $big_kml_file?"
    exit 1
fi