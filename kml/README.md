Download the MBTA GTFS file from
http://www.mbta.com/rider_tools/developers/default.asp?id=21895

Run `go run ../tools/route-kml.go ../MBTA_GTFS.zip`.  KML files will be
output in the current directory.  Filenames are `<route_id>.kml`.
