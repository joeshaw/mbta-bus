// Generate KML files given the GTFS input.  Should be run from the directory
// where you want the KML files, probably ../kml.

package main

import (
	"fmt"
	"io"
	"log"
	"os"

	"github.com/geops/gtfsparser"
	"github.com/geops/gtfsparser/gtfs"
	"github.com/gershwinlabs/gokml"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: route-kml MBTA_GTFS.zip")
	}

	feed := gtfsparser.NewFeed()

	if err := feed.Parse(os.Args[1]); err != nil {
		log.Fatal(err)
	}

	routeMap := map[string]map[string]*gtfs.Shape{}

	for _, trip := range feed.Trips {
		if trip.Shape == nil {
			continue
		}

		if _, ok := routeMap[trip.Route.Id]; !ok {
			routeMap[trip.Route.Id] = map[string]*gtfs.Shape{}
		}

		routeMap[trip.Route.Id][trip.Shape.Id] = trip.Shape
	}

	for routeID, shapeMap := range routeMap {
		fmt.Printf("Generating for route %s\n", routeID)

		f, err := os.Create(routeID + ".kml")
		if err != nil {
			log.Fatal(err)
		}

		kml := gokml.NewKML(routeID)
		for _, shape := range shapeMap {
			ls := gokml.NewLineString()
			for _, p := range shape.Points {
				point := gokml.NewPoint(float64(p.Lat), float64(p.Lon), 0)
				ls.AddPoint(point)
			}
			pm := gokml.NewPlacemark(shape.Id, shape.Id, ls)
			kml.AddFeature(pm)
		}

		io.WriteString(f, kml.Render())
		f.Close()
	}
}
