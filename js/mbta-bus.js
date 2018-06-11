var style, gestureHandling;
if (navigator.userAgent.indexOf('iPhone') != -1 || navigator.userAgent.indexOf('Android') != -1 ) {
    style = "width: 100%; height: 300px;";
    gestureHandling = "cooperative";
} else {
    style = "width: 100%; height: 600px;";
    gestureHandling = "greedy";
}

Vue.use(VueGoogleMaps, {
    load: {
        key: 'AIzaSyBuDLNN2zftYHZtrxnAwOcVYUF0zgJQukU',
        libraries: "geometry",
    },
});

const app = new Vue({
    el: "#map",
    data: {
        routes: [],
        stops: [],
        vehicles: [],
        trips: {},
        headsigns: [],
        shapes: [],
        bounds: null,
        selectedRoute: null,
        previousRoute: null,
        intervalID: 0,
        infoWindowOpen: false,
        infoWindowPosition: null,
        infoWindowContent: "",
        infoWindowItem: null,
        infoOptions: {
            pixelOffset: {
                width: 0,
                height: 0
            }
        },
        polylineOptions: {
            strokeColor: "#0000ff",
            strokeOpacity: 1,
            strokeWeight: 5,
        },
        center: {
            lat: 42.357778,
            lng: -71.061667
        },
        options: {
            gestureHandling: gestureHandling,
        },
        style: style,
        markerIcons: [
            "images/red-dot.png",
            "images/blue-dot.png",
            "images/green-dot.png",
            "images/yellow-dot.png",
            "images/orange-dot.png",
            "images/purple-dot.png"
        ],
        mbtaKey: "5e5bb76ad00f4a608cf6cf70ccd8e12d"
    },
    methods: {
        displayName: function(route) {
            return route.attributes.long_name.length > 0 ?
                route.attributes.long_name :
                route.attributes.short_name;
        },

        routeChanged: function(event) {
            if (this.selectedRoute === null) {
                return;
            }
            fetch("https://api-v3.mbta.com/stops?filter[route]=" + this.selectedRoute.id + "&api_key=" + this.mbtaKey)
                .then(response => response.json())
                .then(json => {
                    this.stops = json.data;
                });
            fetch("https://api-v3.mbta.com/shapes?filter[route]=" + this.selectedRoute.id + "&api_key=" + this.mbtaKey)
                .then(response => response.json())
                .then(json => {
                    this.shapes = json.data;
                })
                .then(() => {
                    this.bounds = new google.maps.LatLngBounds();
                    this.shapes.forEach((shape) => {
                        this.getPath(shape).forEach((point) => {
                            this.bounds.extend(new google.maps.LatLng(point.lat(), point.lng()));
                        });
                    });
                    this.$refs.map.fitBounds(this.bounds);
                });
            this.updateVehicles();
            this.infoWindowOpen = false;
        },

        updateVehicles: function() {
            if (this.selectedRoute === null) {
                return;
            }
            fetch("https://api-v3.mbta.com/vehicles?filter[route]=" + this.selectedRoute.id + "&include=trip&api_key=" + this.mbtaKey)
                .then(response => response.json())
                .then(json => {
                    this.vehicles = json.data;
                    this.trips = json.included || [];
                    this.headsigns = [...new Set(this.trips.map(function(t) {
                        return t.attributes.headsign;
                    }))];
                });
        },

        visibilityChanged: function(event) {
            if (document.hidden && this.intervalID != 0) {
                clearInterval(this.intervalID);
                this.intervalID = 0;
            } else if (!document.hidden && this.intervalID == 0) {
                this.routeChanged();
                this.intervalID = setInterval(() => {
                    this.updateVehicles();
                }, 10000);
            }
        },

        getPath: function(shape) {
            return google.maps.geometry.encoding.decodePath(shape.attributes.polyline);
        },

        position: function(item) {
            return { lat: item.attributes.latitude, lng: item.attributes.longitude };
        },

        getTrip: function(id) {
            for (var i = 0; i < this.trips.length; i++) {
                if (this.trips[i].id == id) {
                    return this.trips[i];
                }
            }
            return null;
        },

        vehicleIcon: function(vehicle) {
            var trip = this.getTrip(vehicle.relationships.trip.data.id);
            if (trip == null) {
                return null;
            }
            var idx = this.headsigns.indexOf(trip.attributes.headsign);
            if (idx == -1) {
                return null;
            }
            return this.markerIcons[idx];
        },

        openInfoWindowVehicle: function(vehicle) {
            var trip = this.getTrip(vehicle.relationships.trip.data.id);
            this.infoOptions.pixelOffset.height = -35;
            this.infoWindowContent = "<h3>Route " + this.displayName(this.selectedRoute) + "</h3>";
            this.infoWindowContent += "<p>" + this.selectedRoute.attributes.direction_names[vehicle.attributes.direction_id];
            if (trip != null) {
                this.infoWindowContent += " to " + trip.attributes.headsign;
            }
            this.infoWindowContent += "</p>";
            this.infoWindowPosition = this.position(vehicle);
            this.infoWindowOpen = true;
        },

        openInfoWindowStop: function(stop) {
            this.infoWindowOpen = false;
            fetch("https://api-v3.mbta.com/predictions?filter[stop]=" + stop.id + "&api_key=" + this.mbtaKey)
                .then(response => response.json())
                .then(json => {
                    this.infoOptions.pixelOffset.height = 0;
                    this.infoWindowContent = "<h3>" + stop.attributes.name + "</h3>";
                    var predictions = json.data.filter(
                        (p) => p.relationships.route.data.id === this.selectedRoute.id
                    );
                    if (predictions.length == 0) {
                        this.infoWindowContent += "<p>No vehicles expected.</p>";
                    } else {
                        this.infoWindowContent += "<ul>";
                        for (var i = 0; i < predictions.length; i++) {
                            var p = predictions[i];
                            var when = Date.parse(p.attributes.departure_time);
                            var away = (when - Date.now()) / 1000;
                            this.infoWindowContent += "<li>";
                            if (away <= 0) {
                                this.infoWindowContent += "now";
                            } else if (away < 60) {
                                this.infoWindowContent += Math.floor(away) + " seconds";
                            } else {
                                this.infoWindowContent += Math.floor(away/60) + " minutes";
                            }
                            this.infoWindowContent += "</li>";
                        }
                        this.infoWindowContent += "<ul>";
                    }
                    this.infoWindowPosition = this.position(stop);
                    this.infoWindowOpen = true;
                });
        },
    },
    created () {
        fetch("https://api-v3.mbta.com/routes?api_key=" + this.mbtaKey)
            .then(response => response.json())
            .then(json => {
                this.routes = json.data;
            })
    },
    mounted: function() {
        this.visibilityChanged();
        document.addEventListener("visibilitychange", this.visibilityChanged, false);
    }
});
