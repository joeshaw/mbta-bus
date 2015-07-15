// Generate KML files given the GTFS input.  Should be run from the directory
// where you want the KML files, probably ../kml.

package main

import (
	"fmt"
	"io"
	"log"
	"os"
	"sort"

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

	routeMap := map[string][]*gtfs.Shape{}

	for _, trip := range feed.Trips {
		if trip.Shape == nil {
			continue
		}

		found := false
		for _, shape := range routeMap[trip.Route.Id] {
			if shape == trip.Shape {
				found = true
				break
			}
		}

		if !found {
			routeMap[trip.Route.Id] = append(routeMap[trip.Route.Id], trip.Shape)
		}
	}

	for routeID, shapes := range routeMap {
		fmt.Printf("Generating for route %s\n", routeID)

		sort.Sort(ByShapeID(shapes))

		f, err := os.Create(routeID + ".kml")
		if err != nil {
			log.Fatal(err)
		}

		kml := gokml.NewKML(routeID)
		for _, shape := range shapes {
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

type ByShapeID []*gtfs.Shape

func (s ByShapeID) Len() int {
	return len(s)
}

func (s ByShapeID) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

func (s ByShapeID) Less(i, j int) bool {
	return s[i].Id < s[j].Id
}
