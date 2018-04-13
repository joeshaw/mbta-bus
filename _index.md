---
title: MBTA Google Maps mashup
description: Where's the bus? (or the subway, or the commuter rail, or the ferry)
date: 2009-11-15T23:31:48-05:00
tags: [mbta, bus, maps, mashup, subway, commuter, ferry]
layout: bus
---

<div style="margin: 0 20px;">
  <select id="option_list" style="margin: 10px 0;">
    <option value="">Select Route</option>
  </select>
  <div id="map_canvas"></div>
  <div id="marker_legend"></div>
</div>

## About

The [MBTA](http://mbta.com/) provides a [real-time
feed](http://realtime.mbta.com) of locations of vehicles on its bus,
subway, commuter rail, and ferry routes.

This is a little mashup which takes that real-time data and plots it
on [Google Maps](https://maps.google.com).  Choose a route from
the pull down menu below and markers will appear with the latest
locations of its buses.  Markers will update with the latest
information from the T every 10 seconds.  Click on a stop marker
to see predictions for when the next vehicle will arrive.

It is built in about 300 lines of very amateur JavaScript.  It uses
the [MBTA real-time API](http://realtime.mbta.com/) to
get the data from the MBTA.  Source code is available on
[GitHub](https://github.com/joeshaw/mbta-bus).

If you have any questions or comments, please feel free to
[email](mailto:joe@joeshaw.org) or
[tweet](https://twitter.com/?status=@joeshaw%20) them to me.

The original version of this site went up on 14 November 2009, one day
after the MBTA first made this data available for buses.  It has been
updated periodically since then.  The latest update came on 13 July
2015, when the site was ported from the now-discontinued Proximobus
API to the MBTA's official v2 API.  This change brought in subway,
commuter rail, and ferry locations in addition to buses.

<script type="text/javascript" src="https://ajax.googleapis.com/ajax/libs/jquery/1.3.2/jquery.min.js"></script>
<script src="https://maps.google.com/maps/api/js?sensor=false" type="text/javascript"></script><script type="text/javascript">
  $(document).ready(function() {
    var useragent = navigator.userAgent;
    var map_canvas = document.getElementById("map_canvas");

    if (useragent.indexOf('iPhone') != -1 || useragent.indexOf('Android') != -1 ) {
      map_canvas.style.width = '100%';
      map_canvas.style.height = '300px';
    } else {
      map_canvas.style.width = '100%';
      map_canvas.style.height = '600px';
    }

    var mapOptions = {
      zoom: 12,
      center: new google.maps.LatLng(42.357778, -71.061667),
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    var map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);

    var base_url = "https://joeshaw.org/mbta-bus/proxy/developer/api/v2";
    var req_args = "api_key=K3oa39EuG0WuiQpsWZ9Duw&format=json";

    var direction_data = [
      { icon: "images/red-dot.png",
        line_color: "#FF0000" },

      { icon: "images/blue-dot.png",
        line_color: "#0000FF" },

      { icon: "images/green-dot.png",
        line_color: "#00FF00" },

      { icon: "images/yellow-dot.png",
        line_color: "#FFFF00" },

      { icon: "images/orange-dot.png",
        line_color: "#FF7700" },

      { icon: "images/purple-dot.png",
        line_color: "#FF00FF" }
    ];

    // Some global variables
    var selected_route = "";
    var vehicle_markers = {};
    var stop_markers = [];
    var route_layer = null;
    var lines = [];
    var open_info_window = null;
    var updateIntervalID = 0;

    populateRouteList();

    // Update the markers any time the option box is changed, or
    // every 10 seconds as long as the window is visible.
    $("select").change(updateMarkers);
    if (!document.hidden) {
      updateIntervalID = setInterval(updateMarkers, 10000);
    }

    function handleVisibilityChange() {
      if (document.hidden && updateIntervalID) {
        clearInterval(updateIntervalID);
        updateIntervalID = 0;
      } else if (!document.hidden && !updateIntervalID) {
        updateMarkers();
        updateIntervalID = setInterval(updateMarkers, 10000);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange, false);

    function queryParams(qs) {
      qs = qs.split("+").join(" ");

      var params = {};
      var regexp = /[?&]?([^=]+)=([^&]*)/g;
      var tokens;
      while (tokens = regexp.exec(qs)) {
        params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2])
      }
      return params;
    }

    function populateRouteList() {
      $.getJSON(base_url + "/routes?" + req_args,
        function(data) {
          for (var i = 0; i < data.mode.length; i++) {
            var mode = data.mode[i]

            for (var j = 0; j < mode.route.length; j++) {
              var route = mode.route[j]
              if (route.route_hide) {
                continue
              }

              $("#option_list").append('<option value="' + route.route_id + '">' + route.route_name + '</option>');
            }
          }

          params = queryParams(document.location.search);
          if (params["route"]) {
            $("#option_list option[value=\"" + params["route"] + "\"]").attr('selected', 'selected');
            updateMarkers();
          }
        }
      );
    }

    function resetRouteMarkers() {
      for (var i = 0; i < stop_markers.length; i++) {
        stop_markers[i].setMap(null);
      }
      stop_markers = [];

      for (var i = 0; i < lines.length; i++) {
        lines[i].setMap(null);
      }
      lines = [];

      if (route_layer !== null) {
        route_layer.setMap(null);
        route_layer = null;
      }
    }

    function resetVehicleMarkers() {
      $("#marker_legend").empty();

      for (var vehicle_id in vehicle_markers) {
        vehicle_markers[vehicle_id].setMap(null);
      }
      vehicle_markers = {};
    }

    function updateMarkers() {
      var old_route = selected_route;
      selected_route = $("select option:selected").attr("value");

      if (selected_route != old_route) {
        resetRouteMarkers();
        resetVehicleMarkers();
      }

      if (selected_route == "") {
        return;
      }

      if (selected_route != old_route) {
        fetchRouteData(selected_route);
      }

      fetchVehicles(selected_route);
    }

    function fetchRouteData(route_id) {
      var stops_url = base_url + "/stopsbyroute?route=" + route_id + "&" + req_args;
      $.getJSON(stops_url, function(data) {
        var bounds = new google.maps.LatLngBounds();

        for (var i = 0; i < data.direction.length; i++) {
          var direction = data.direction[i];

          addLegend(direction_data[i].icon, direction.direction_name);

          var stop_latlongs = [];

          for (var j = 0; j < direction.stop.length; j++) {
            var stop = direction.stop[j]
            var latlong = placeStop(route_id, direction.direction_id, direction.direction_name, stop);
            bounds.extend(latlong)
            stop_latlongs.push(latlong)
          }
        }

        route_layer = new google.maps.KmlLayer({
          url: "https://joeshaw.org/mbta-bus/kml/" + route_id + ".kml",
          suppressInfoWindows: true,
          map: map
        });

        map.fitBounds(bounds)
      });
    }

    function placeStop(route_id, direction_id, direction_name, stop) {
      var latlong = new google.maps.LatLng(stop.stop_lat, stop.stop_lon);

      var marker = new google.maps.Marker({
        position: latlong,
        map: map,
        icon: "https://www.nextmuni.com/googleMap/images/stopMarkerRed.gif"
      });

      marker.stop_id = stop.stop_id;
      marker.infoContent = '<h3>' + stop.stop_name + '</h3>';
      marker.infoContent += '<p>' + direction_name  + '</p>';

      google.maps.event.addListener(marker, "click", function() {
        var info_window = new google.maps.InfoWindow({
          content: this.infoContent,
        });

        var prediction_url = base_url + "/predictionsbystop?stop=" + stop.stop_id + "&" + req_args;
        $.getJSON(prediction_url, function(data) {
          for (var i = 0; i < data.mode.length; i++) {
            var mode = data.mode[i];
            for (var j = 0; j < mode.route.length; j++) {
              var route = mode.route[j];
              if (route_id != route.route_id) {
                continue
              }

              for (var k = 0; k < route.direction.length; k++) {
                var direction = route.direction[k];
                if (direction_id != direction.direction_id) {
                  continue
                }

                var content = info_window.getContent();
                if (direction.trip.length == 0) {
                  content += '<p>No vehicles expected.</p>';
                } else {
                  content += '<p>Expected arrivals:';
                  content += '<ul>';

                  // oh honestly...
                  for (var l = 0; l < direction.trip.length; l++) {
                    var trip = direction.trip[l];
                    var away = parseInt(trip.pre_away);

                    content += '<li>';
                    if (away < 60) {
                      content += away + " seconds";
                    } else {
                      content += Math.floor(away/60) + " minutes";
                    }

                    content += '</li>';
                  }

                  content += '</ul></p>';
                  info_window.setContent(content);
                }
              }
            }
          }
        });

        google.maps.event.addListener(info_window, "closeclick", function() {
          open_info_window = null;
        });

        if (open_info_window) {
          open_info_window.close();
        }
        open_info_window = info_window;

        info_window.open(map, this);
      });

      stop_markers.push(marker);
      return latlong;
    }

    function addLegend(icon, name) {
      $("#marker_legend").append('<img src="' + icon + '">' + name);
    }

    function fetchVehicles(route_id) {
      var vehicle_url = base_url + "/vehiclesbyroute?route=" + route_id + "&" + req_args;
      $.getJSON(vehicle_url, function(data) {
        var new_markers = {}

        for (var i = 0; i < data.direction.length; i++) {
          var direction = data.direction[i];

          for (var j = 0; j < direction.trip.length; j++) {
            var trip = direction.trip[j];
            var vehicle = trip.vehicle;
            var latlong = new google.maps.LatLng(vehicle.vehicle_lat, vehicle.vehicle_lon);

            var marker = vehicle_markers[vehicle.vehicle_id];
            if (!marker) {
              var marker = new google.maps.Marker({
                position: latlong,
                map: map,
                icon: direction_data[i].icon
              });

              marker.infoContent = '<h3>Route ' + data.route_name + ' ' + direction.direction_name + '</h3>';
              marker.infoContent += '<p>' + trip.trip_headsign + '</p>';

              google.maps.event.addListener(marker, "click", function() {
                var info_window = new google.maps.InfoWindow({
                  content: this.infoContent,
                });

                google.maps.event.addListener(info_window, "closeclick", function() {
                  open_info_window = null;
                });

                if (open_info_window) {
                  open_info_window.close();
                }
                open_info_window = info_window;
                info_window.open(map, this);
              });
            } else {
              marker.setPosition(latlong);
              marker.setIcon(direction_data[i].icon);
            }

            new_markers[vehicle.vehicle_id] = marker;
            delete vehicle_markers[vehicle.vehicle_id];
          }
        }

        // Buses no longer on the map
        for (var vehicle_id in vehicle_markers) {
          vehicle_markers[vehicle_id].setMap(null);
        }
        vehicle_markers = new_markers;
      });
    }

  });
</script>

