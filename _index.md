---
title: MBTA Tracker
description: Where's the bus? (or the subway, or the commuter rail, or the ferry)
date: 2009-11-15T23:31:48-05:00
tags: [mbta, bus, maps, mashup, subway, commuter, ferry]
layout: bus
---

<div id="map" style="margin: 0 20px;">
    <select style="margin: 10px 0; font-size: 16px;" v-model="selectedRoute" v-on:change="routeChanged">
        <option disabled value="">Select Route</option>
        <option v-for="route in routes" v-bind:value="route">
            {{ displayName(route) }}
        </option>
    </select>
    <gmap-map :center="center" :zoom="12" :style="style" ref="map">
        <!--<gmap-kml-layer :url="kmlURL" :clickable="false"></gmap-kml-layer>-->
        <gmap-polyline v-for="shape in shapes" :path="getPath(shape)" :key="shape.id" :options="polylineOptions"></gmap-polyline>
        <gmap-info-window :options="infoOptions" :position="infoWindowPosition" :opened="infoWindowOpen" @closeclick="infoWindowOpen=false"><span v-html="infoWindowContent"></span></gmap-info-window>
        <gmap-marker v-for="stop in stops" :key="stop.id" :position="position(stop)" :clickable="true" @click="openInfoWindowStop(stop)" icon="/mbta-bus/images/stop-marker.gif"></gmap-marker>
        <gmap-marker v-for="vehicle in vehicles" :key="vehicle.id" :position="position(vehicle)" :icon="vehicleIcon(vehicle)" :clickable="true" @click="openInfoWindowVehicle(vehicle)"></gmap-marker>
    </gmap-map>
    <div>
        <span v-for="(headsign, index) in headsigns" :key="headsign"><img :src="markerIcons[index]" style="display: inline;">{{ headsign }}</span>
    </div>
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

This is version 4 of this project, released in 10 June 2018.  It is
written in Javascript, using [Vue.js](https://vuejs.org), the Google
Maps v3 API and the [MBTA v3 API](https://www.mbta.com/developers/v3-api).
The source code is available on [GitHub](https://github.com/joeshaw/mbta-bus).

The original version of this site went up on 14 November 2009, one day
after the MBTA first made this data available for buses.  Version 2
was released 6 June 2010, which introduced stop markers and
predictions.  Version 3 was released on 13 July 2015, and switched to
the MBTA's official v2 API, which added subway, commuter rail, and
ferry tracking in addition to buses.

If you have any questions or comments, please feel free to
[email](mailto:joe@joeshaw.org) or
[tweet](https://twitter.com/?status=@joeshaw%20) them to me.


<script type="text/javascript" src="js/vue.min.js"></script>
<script type="text/javascript" src="js/vue-google-maps.js"></script>
<script type="text/javascript" src="js/mbta-bus.js"></script>
