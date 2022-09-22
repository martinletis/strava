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
      .then(response => response.json())
      .then(data => {
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
    authorizeUrl.searchParams.append('scope', 'read,activity:read');
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
      .then(response => response.json())
      .then(data => {
        window.localStorage.setItem('token', JSON.stringify(data));
        window.location.replace(redirectUrl.toString())
      });
    return;
  }

  return token.access_token;
}

function initMap(position) {
  const access_token = initAuth();

  if (!access_token) {
    return;
  }

  require([
    'esri/config',
    'esri/Graphic',
    'esri/Map',
    'esri/views/MapView',
    'esri/geometry/Circle',
    'esri/layers/FeatureLayer',
    'esri/widgets/BasemapToggle',
    'esri/widgets/TimeSlider',
  ], function (esriConfig, Graphic, Map, MapView, Circle, FeatureLayer, BasemapToggle, TimeSlider) {
    esriConfig.apiKey = 'AAPKf03cf57d366c4959839d3651bebe9518WLMakWBAkZ0QSXyTkbg4NStT8jUqv5zKfS46AM5Aiipk5YS40KMImE2t8xzqBp_4';
    
    const cityOfSydneyLayer = new FeatureLayer({
      portalItem: {
        id: '6e8360afd7f9499ab9425b2d17db730d',
      },
      renderer: {
        type: 'simple',
        symbol: {
          type: 'simple-fill',
          color: [255, 255, 0, 0.1],
          outline: {
            color: [255, 255, 0, 1],
            width: 0.2,
          },
        },
      },
      visible: false,
    });

    const map = new Map({
      basemap: 'arcgis-terrain',
      layers: [cityOfSydneyLayer],
    });

    const view = new MapView({
      map: map,
      center: position ? [position.coords.longitude, position.coords.latitude] : undefined,
      zoom: 12,
      container: position ? 'viewDiv' : undefined,
    });

    view.ui.add('titleDiv', 'top-right');

    const basemapToggle = new BasemapToggle({
      view: view,
      nextBasemap: 'arcgis-light-gray'
    });
    view.ui.add(basemapToggle, 'bottom-right');

    const circle5k = new Graphic({
      geometry: new Circle({
        center: [151.19562741241154, -33.87180353506704],
        geodesic: true,
        radius: 5,
        radiusUnit: "kilometers",
      }),
      symbol: {
        type: 'simple-line',
        color: 'blue',
        width: 0.8,
      },
      visible: false,
    });
    view.graphics.add(circle5k);

    const circle10k = new Graphic({
      geometry: new Circle({
        center: [151.19562741241154, -33.87180353506704],
        geodesic: true,
        radius: 10,
        radiusUnit: "kilometers",
      }),
      symbol: {
        type: 'simple-line',
        color: 'blue',
        width: 0.8,
      },
      visible: false,
    });
    view.graphics.add(circle10k);

    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1);

    const timeSlider = new TimeSlider({
      actions: [
        {
          id: 'all',
          icon: 'content-full',
          title: 'All Time',
        },
        {
          id: 'lockdown10k',
          icon: 'lock',
          title: 'Sydney 10k Lockdown',
        },
        {
          id: 'lockdown5k',
          icon: 'lock',
          title: 'Sydney 5k Lockdown',
        },
      ],
      container: 'timeSlider',
      disabled: true,
      fullTimeExtent: {
        'end': end,
        'start': start,
      },
      mode: 'time-window',
      stops: {
        interval: {
          value: 1,
          unit: 'days',
        },
      },
      timeExtent: {
       'end': end,
       'start': start,
      },
      view: view,
    });

    // https://www.nsw.gov.au/media-releases/covid-19-restrictions-tightened-across-greater-sydney
    const _10K_START = new Date(1625814000000);

    // https://www.nsw.gov.au/media-releases/increased-fines-test-and-isolate-payments-and-new-compliance-measures-as-nsw-battles
    const _10K_END = new Date(1629036060000);

    // https://www.nsw.gov.au/media-releases/roadmap-to-freedom-unveiled-for-fully-vaccinated
    // https://www.nsw.gov.au/media-releases/roadmap-to-recovery-reveals-path-forward-for-all-nsw
    const _5K_END = new Date(1633870860000);

    timeSlider.on('trigger-action', event => {
      switch(event.action.id) {
        case 'all':
          timeSlider.timeExtent = timeSlider.fullTimeExtent;
          break;
        case 'lockdown10k':
          timeSlider.timeExtent = {
            start: _10K_START,
            end: _10K_END,
          };
          break;
        case 'lockdown5k':
          timeSlider.timeExtent = {
            start: _10K_END,
            end: _5K_END,
          };
          break;
        default:
          console.error('Invalid action ID: ' + event.action.id);
      }
    });
    timeSlider.watch('timeExtent', timeExtent => {
      circle10k.visible = timeExtent.start >= _10K_START && timeExtent.end <= _10K_END;
      circle5k.visible = cityOfSydneyLayer.visible = timeExtent.start >= _10K_END && timeExtent.end <= _5K_END;
    });
    view.ui.add(timeSlider, 'manual');

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

    const fetchActivities = function(activitiesUrl, page) {
      activitiesUrl.searchParams.set('page', page);

      fetch(activitiesUrl, {headers: {'Authorization': 'Bearer ' + access_token}})
        .then(response => response.json())
        .then(activities => {
          activities.forEach(activity => {
            const activity_start_date = new Date(activity.start_date);
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
                StartDate: activity_start_date.toString(),
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
              visible: activity_start_date >= timeSlider.timeExtent.start && activity_start_date <= timeSlider.timeExtent.end,
            });

            // TODO(martin.letis): deduplicate visibility logic, trigger handler immediately?
            timeSlider.watch('timeExtent', timeExtent => {
              polylineGraphic.visible = activity_start_date >= timeExtent.start && activity_start_date <= timeExtent.end;
            });

            view.graphics.add(polylineGraphic);

            // If the view isn't already centered with 'position', center on the most recent activity.
            if (!view.center && view.graphics.length == 1) {
              view.goTo(view.graphics.toArray(), {animate: false});
              view.container = 'viewDiv';
            }
          });

          if (activities.length > 0) {
            // Get oldest activity date.
            // TODO(martin.letis): is the oldest activity always last?
            const activity_start_dates = activities.map(activity => new Date(activity.start_date).getTime());
            const activity_start_date = new Date(Math.min(...activity_start_dates));
            activity_start_date.setHours(0, 0, 0, 0);

            timeSlider.fullTimeExtent.start = new Date(Math.min(timeSlider.fullTimeExtent.start, activity_start_date));

            // Recursive call for next page.
            fetchActivities(activitiesUrl, page + 1);
            return;
          }

          if (view.graphics.length == 0) {
            // No activities found, error and exit.
            console.error('No activities found on Strava');
            document.getElementById('titleText').innerHTML = 'No activities found on Strava';
            return;
          }

          // Enable slider.
          timeSlider.disabled = false;

          // Remove loading message.
          view.ui.remove('titleDiv');
        });  
    }

    var activitiesUrl = new URL('https://www.strava.com/api/v3/athlete/activities');
    activitiesUrl.searchParams.append('per_page', 100);
    fetchActivities(activitiesUrl, 1);
  });
}

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    position => initMap(position),
    positionError => {
      console.warn(positionError);
      initMap();
    });
} else {
  console.warn('Geolocation not available');
  initMap();
}
