function map(after, before, per_page, radius, zoom) {
  var map = new google.maps.Map(document.getElementById('map'), {
    mapTypeId: google.maps.MapTypeId.TERRAIN,
    zoom: zoom,
  });

  var geocoder = new google.maps.Geocoder();
  geocoder.geocode({'address': '149-197 Pyrmont Street, Pyrmont NSW 2009, Australia'}, function(results, status) {
    if (status == 'OK') {
      map.setCenter(results[0].geometry.location);
      new google.maps.Marker({
          map: map,
          position: results[0].geometry.location
      });
      
      if (radius) {
        new google.maps.Circle({
          strokeColor: 'red',
          strokeOpacity: 0.6,
          strokeWeight: 1,
          fillColor: 'red',
          fillOpacity: 0.02,
          map,
          center: results[0].geometry.location,
          radius: radius,
        });
      }
    } else {
      alert('Geocode was not successful for the following reason: ' + status);
    }
  });
  
  // http://data.cityofsydney.nsw.gov.au/datasets/the-city-of-sydney-local-government-area-2
  map.data.loadGeoJson('https://opendata.arcgis.com/datasets/6e8360afd7f9499ab9425b2d17db730d_0.geojson');
  map.data.setStyle({
    strokeColor: 'blue',
    strokeOpacity: 0.6,
    strokeWeight: 1,
    fillColor: 'blue',
    fillOpacity: 0.02,
  });
  
  var activitiesUrl = new URL('/activities', window.location.origin);
  if (after) {
    activitiesUrl.searchParams.append('after', after);
  }
  if (before) {
    activitiesUrl.searchParams.append('before', before);
  }
  if (per_page) {
    activitiesUrl.searchParams.append('per_page', per_page);
  }
  fetchActivities(activitiesUrl, map, 1);
}

function fetchActivities(activitiesUrl, map, page) {
  activitiesUrl.searchParams.set('page', page);

  var colors = {
    'Walk': 'blue',
    'Ride': 'red',
    'Hike': 'yellow',
  };
  var opacity = {
    'Walk': 0.4,
    'Ride': 0.4,
    'Hike': 0.6,
  };

  fetch(activitiesUrl)
  .then(response => response.json())
  .then(activities => {
    activities.forEach(activity => new google.maps.Polyline({
      path: google.maps.geometry.encoding.decodePath(activity.map.summary_polyline),
      strokeColor: colors[activity.type],
      strokeOpacity: opacity[activity.type],
      strokeWeight: 6,
      map: map
    }));
    if (activities.length > 0) {
      fetchActivities(activitiesUrl, map, page+1);
    }
  });
}

