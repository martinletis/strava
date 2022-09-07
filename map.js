function initAuth() {
  const CLIENT_ID = 69382;
  const CLIENT_SECRET = '5bcd3a399f4c849a2ffadf249eccecabbbaddca9';

  const url = new URL(window.location.href);

  const redirectUrl = new URL(url);
  redirectUrl.search = '';

  // https://developers.strava.com/docs/authentication/#tokenexchange
  if (url.searchParams.has('code')) {
    const tokenUrl = new URL('https://www.strava.com/oauth/token');
    tokenUrl.searchParams.append('client_id', CLIENT_ID);
    tokenUrl.searchParams.append('client_secret', CLIENT_SECRET);
    tokenUrl.searchParams.append('code', url.searchParams.get('code'));
    tokenUrl.searchParams.append('grant_type', 'authorization_code');
    fetch(tokenUrl, {method: 'POST'})
      .then((response) => response.json())
      .then((data) => {
        window.localStorage.setItem('token', JSON.stringify(data));
        window.location.replace(redirectUrl.toString())
      });
    return;
  }

  // https://developers.strava.com/docs/authentication/#detailsaboutrequestingaccess
  if (!window.localStorage.getItem('token')) {
    const authorizeUrl = new URL('https://www.strava.com/oauth/authorize');
    authorizeUrl.searchParams.append('client_id', CLIENT_ID);
    authorizeUrl.searchParams.append('redirect_uri', redirectUrl.toString());
    authorizeUrl.searchParams.append('response_type', 'code');
    authorizeUrl.searchParams.append('scope', 'activity:read');
    window.location.replace(authorizeUrl.toString());
    return;
  }

  const token = JSON.parse(window.localStorage.getItem('token'));

  // https://developers.strava.com/docs/authentication/#refreshingexpiredaccesstokens
  if (token.expires_at * 1000 < Date.now()) {
    const tokenUrl = new URL('https://www.strava.com/oauth/token');
    tokenUrl.searchParams.append('client_id', CLIENT_ID);
    tokenUrl.searchParams.append('client_secret', CLIENT_SECRET);
    tokenUrl.searchParams.append('grant_type', 'refresh_token');
    tokenUrl.searchParams.append('refresh_token', token.refresh_token);
    fetch(tokenUrl, {method: 'POST'})
      .then((response) => response.json())
      .then((data) => {
        window.localStorage.setItem('token', JSON.stringify(data));
        window.location.replace(redirectUrl.toString())
      });
    return;
  }

  return token.access_token;
}

const COLORS = {
  'Walk': 'blue',
  'Ride': 'red',
  'Hike': 'green',
};
const WIDTH = {
  'Walk': 1.0,
  'Ride': 1.0,
  'Hike': 1.4,
};

function fetchActivities(activitiesUrl, Graphic, view, page) {
  activitiesUrl.searchParams.set('page', page);

  fetch(activitiesUrl, {headers: {'Authorization': 'Bearer ' + access_token}})
    .then((response) => response.json())
    .then((activities) => {
      activities.forEach(activity => {
        const paths = google.maps.geometry.encoding.decodePath(activity.map.summary_polyline).map(latlng => [latlng.lng(), latlng.lat()]);
        const polylineGraphic = new Graphic({
          geometry: {
            type: 'polyline',
            paths: paths,
          },
          symbol: {
            type: 'simple-line',
            color: COLORS[activity.sport_type],
            width: WIDTH[activity.sport_type],
          },
          attributes: {
            Id: activity.id,
            Name: activity.name,
            SportType: activity.sport_type,
            StartDate: new Date(activity.start_date).toString(),
            Distance: (Math.round(activity.distance / 10) / 100).toLocaleString(),
            MovingTime: new Date(activity.moving_time * 1000).toISOString().substr(11, 8),
            TotalElevationGain: activity.total_elevation_gain.toLocaleString(),
            AverageWatts: activity.average_watts ? activity.average_watts.toLocaleString() : 'NaN',
            KiloJoules: activity.kilojoules ? activity.kilojoules.toLocaleString() : 'NaN',
            AvgSpeed: (Math.round(activity.average_speed * 3600 / 100) / 10).toLocaleString(),
            MaxSpeed: (Math.round(activity.max_speed * 3600 / 100) / 10).toLocaleString(),
            ElapsedTime: new Date(activity.elapsed_time * 1000).toISOString().substr(11, 8),
            
          },
          popupTemplate: {
            title: '<b>{Name}</b><br/><small>{StartDate}</small>',
            content: 
              'Distance: <b>{Distance} km</b><br/>' + 
              'Moving Time: <b>{MovingTime}</b><br/>' + 
              'Elevation: <b>{TotalElevationGain} m</b><br/>' + 
              'Estimated Avg Power: <b>{AverageWatts} w</b><br/>' + 
              'Energy Output: <b>{KiloJoules} kJ</b><br/>' + 
              'Avg Speed: <b>{AvgSpeed} km/h</b><br/>' + 
              'Max Speed: <b>{MaxSpeed} km/h</b><br/>' + 
              'Elapsed time: <b>{ElapsedTime}</b><br/><br/>' +
              '<a href="https://www.strava.com/activities/{Id}">https://www.strava.com/activities/{Id}</a>',
          },
        });
        view.graphics.add(polylineGraphic);
      });
      if (activities.length > 0) {
        fetchActivities(activitiesUrl, Graphic, view, page+1);
      }
    });  
}

const access_token = initAuth();

require([
  'esri/config',
  'esri/Graphic',
  'esri/Map',
  'esri/views/MapView',
  'esri/layers/FeatureLayer',
  'esri/widgets/BasemapToggle',
], function (esriConfig, Graphic, Map, MapView, FeatureLayer, BasemapToggle) {
  esriConfig.apiKey = 'AAPKf03cf57d366c4959839d3651bebe9518WLMakWBAkZ0QSXyTkbg4NStT8jUqv5zKfS46AM5Aiipk5YS40KMImE2t8xzqBp_4';
  
  const cityOfSydneyLayer = new FeatureLayer({
    portalItem: {
      id: '6e8360afd7f9499ab9425b2d17db730d',
    },
    renderer: {
      type: 'simple',
      symbol: {
        type: 'simple-fill',
        color: [255, 255, 0, 0.02],
        outline: {
          color: [255, 255, 0, 1],
          width: 0.2,
        },
      },
    },
  });

  const map = new Map({
    basemap: 'arcgis-terrain',
    // layers: [cityOfSydneyLayer],
  });

  // TODO(martin.letis): auto-center
  const view = new MapView({
    map: map,
    center: [151.20, -33.85],
    zoom: 11,
    container: 'viewDiv',
  });

  const basemapToggle = new BasemapToggle({
    view: view,
    nextBasemap: 'arcgis-light-gray'
  });
  view.ui.add(basemapToggle, 'bottom-right');

  var activitiesUrl = new URL('https://www.strava.com/api/v3/athlete/activities');
  // activitiesUrl.searchParams.append('after', 1633870860);
  activitiesUrl.searchParams.append('per_page', 100);
  fetchActivities(activitiesUrl, Graphic, view, 1);
});
