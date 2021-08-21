function map(after, before, radius, zoom) {
  var map = new google.maps.Map(document.getElementById('map'), {
    zoom: zoom,
  });
  var geocoder = new google.maps.Geocoder();

  geocoder.geocode({'address': '149-197 Pyrmont Street, Pyrmont NSW 2009, Australia'}, function(results, status) {
    if (status == 'OK') {
      map.setCenter(results[0].geometry.location);
      var marker = new google.maps.Marker({
          map: map,
          position: results[0].geometry.location
      });
      var circle = new google.maps.Circle({
        strokeColor: '#FF0000',
        strokeOpacity: 0.4,
        strokeWeight: 2,
        fillColor: '#FF0000',
        fillOpacity: 0.05,
        map,
        center: results[0].geometry.location,
        radius: radius,
      });
    } else {
      alert('Geocode was not successful for the following reason: ' + status);
    }
  });
  
  var colors = {
    'Walk': '#0000FF',
    'Ride': '#FF0000',
    'Hike': '#00FF00',
  };
  
  var activitiesUrl = new URL('/activities', window.location.origin);
  if (after) {
    activitiesUrl.searchParams.append('after', after);
  }
  if (before) {
    activitiesUrl.searchParams.append('before', before);
  }
  fetch(activitiesUrl)
  .then(response => response.json())
  .then(activities => activities.forEach(activity => new google.maps.Polyline({
    path: google.maps.geometry.encoding.decodePath(activity.map.summary_polyline),
    strokeColor: colors[activity.type],
    strokeOpacity: 0.4,
    strokeWeight: 6,
    map: map
  })));
}

