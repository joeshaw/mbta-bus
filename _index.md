---
title: MBTA Tracker
description: Where's the bus? (or the subway, or the commuter rail, or the ferry)
date: 2009-11-15T23:31:48-05:00
tags: [mbta, bus, maps, mashup, subway, commuter, ferry]
layout: bus
---

<div id="mbta-tracker" style="margin: 0 20px;">
    <select id="route-select" style="margin: 10px 0; font-size: 16px;">
        <option disabled selected value="">Select Route</option>
        <!-- Route options will be populated by JS -->
    </select>
    <div id="map-canvas" style="width: 100%; height: 500px; margin-bottom: 10px;"></div>
    <div id="directions-container">
        <!-- Direction legend will be populated by JS -->
    </div>
</div>

## About

The [MBTA](https://mbta.com/) provides a [real-time
feed](https://www.mbta.com/developers/v3-api) of locations of 
vehicles on its bus, subway, commuter rail, and ferry routes.

This is a little mashup which takes that real-time data and plots it
on [Google Maps](https://maps.google.com).  Choose a route from
the pull down menu below and markers will appear with the latest
locations of its vehicles.  Markers will update with the latest
information from the T every 10 seconds.  Click on a vehicle to see
predictions when it'll arrive at the next few stops.  Click on a
stop marker to see predictions for when the next few vehicles will
arrive.

This is version 5 of this project, released 31 May 2025.  It is 
written in modern Javascript, using the Google Maps JavaScript API 
and the [MBTA v3 API](https://www.mbta.com/developers/v3-api).  I
"vibe coded"  it using GitHub Copilot's AI agent with the Claude
Sonnet 4 model. The source code is available on 
[GitHub](https://github.com/joeshaw/mbta-bus).

The original version of this site went up on 14 November 2009, one day
after the MBTA first made this data available for buses.  Version 2
was released 6 June 2010, which introduced stop markers and
predictions.  Version 3 was released on 13 July 2015, and switched to
the MBTA's official v2 API, which added subway, commuter rail, and
ferry tracking in addition to buses.  Version 4 was released on
10 June 2018, switched to the MBTA v3 API and used Vue.js.

If you have any questions or comments, please feel free to
[email](mailto:joe@joeshaw.org) me.

<script async src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBuDLNN2zftYHZtrxnAwOcVYUF0zgJQukU&libraries=geometry,marker&loading=async&callback=initMap"></script>
<script type="text/javascript" src="js/mbta-bus.js"></script>
