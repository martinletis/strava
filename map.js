import { fetchActivities } from "./activities.js";

const arcgisMap = document.querySelector('arcgis-map');

const arcgisBasemapToggle = document.querySelector('arcgis-basemap-toggle');
arcgisBasemapToggle.nextBasemap = 'arcgis/light-gray'

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    position => {
      arcgisMap.center = [position.coords.longitude, position.coords.latitude];
      arcgisMap.zoom = 12;
    },
    positionError => console.warn(positionError));
} else {
  console.warn('Geolocation not available');
}

const [Graphic, Circle, FeatureLayer] = await $arcgis.import([
  '@arcgis/core/Graphic.js',
  '@arcgis/core/geometry/Circle.js',
  '@arcgis/core/layers/FeatureLayer.js',
]);

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

arcgisMap.addLayer(cityOfSydneyLayer);

const circle5k = new Graphic({
  geometry: new Circle({
    center: [151.19562741241154, -33.87180353506704],
    geodesic: true,
    radius: 5,
    radiusUnit: 'kilometers',
  }),
  symbol: {
    type: 'simple-line',
    color: 'blue',
    width: 0.8,
  },
  visible: false,
});

const circle10k = new Graphic({
  geometry: new Circle({
    center: [151.19562741241154, -33.87180353506704],
    geodesic: true,
    radius: 10,
    radiusUnit: 'kilometers',
  }),
  symbol: {
    type: 'simple-line',
    color: 'blue',
    width: 0.8,
  },
  visible: false,
});

arcgisMap.componentOnReady().then(() => arcgisMap.graphics.addMany([circle5k, circle10k]));

const now = new Date();
const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1);

const arcgisTimeSlider = document.querySelector('arcgis-time-slider');
arcgisTimeSlider.actions = [
  {
    id: '12m',
    icon: 'calendar',
    title: 'Last 12 Months',
  },
  {
    id: 'all',
    icon: 'calendar',
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
];
arcgisTimeSlider.fullTimeExtent = {
  'end': end,
  'start': start,
};
arcgisTimeSlider.stops = {
  interval: {
    value: 1,
    unit: 'days',
  },
};
arcgisTimeSlider.timeExtent = {
  'end': end,
  'start': start,
};

// https://www.nsw.gov.au/media-releases/covid-19-restrictions-tightened-across-greater-sydney
const _10K_START = new Date(1625814000000);

// https://www.nsw.gov.au/media-releases/increased-fines-test-and-isolate-payments-and-new-compliance-measures-as-nsw-battles
const _10K_END = new Date(1629036060000);

// https://www.nsw.gov.au/media-releases/roadmap-to-freedom-unveiled-for-fully-vaccinated
// https://www.nsw.gov.au/media-releases/roadmap-to-recovery-reveals-path-forward-for-all-nsw
const _5K_END = new Date(1633870860000);

arcgisTimeSlider.addEventListener('arcgisTriggerAction', event => {
  switch(event.detail.action.id) {
    case '12m':
      arcgisTimeSlider.timeExtent = {
       'end': end,
       'start': start,
      };
      break;
    case 'all':
      arcgisTimeSlider.timeExtent = arcgisTimeSlider.fullTimeExtent;
      break;
    case 'lockdown10k':
      arcgisTimeSlider.timeExtent = {
        start: _10K_START,
        end: _10K_END,
      };
      arcgisMap.goTo(circle10k);
      break;
    case 'lockdown5k':
      arcgisTimeSlider.timeExtent = {
        start: _10K_END,
        end: _5K_END,
      };
      arcgisMap.goTo(circle5k);
      break;
    default:
      console.error('Invalid action ID: ' + event.action.id);
  }
});
arcgisTimeSlider.addEventListener('arcgisPropertyChange', event => {
  if (event.detail.name != 'timeExtent') {
    return;
  }
  circle10k.visible = arcgisTimeSlider.timeExtent.start >= _10K_START && arcgisTimeSlider.timeExtent.end <= _10K_END;
  circle5k.visible = cityOfSydneyLayer.visible = arcgisTimeSlider.timeExtent.start >= _10K_END && arcgisTimeSlider.timeExtent.end <= _5K_END;
});


const COLORS = {
  'Walk': 'blue',
  'Ride': 'red',
  'Hike': 'green',
  'Run': 'brown',
  'Sail': 'yellow',
};
const WIDTH = {
  'Walk': 1.0,
  'Ride': 1.0,
  'Hike': 1.4,
  'Run': 0.8,
  'Sail': 1.0,
};

const displayActivities = function(activities) {
  activities.forEach(activity => {
    const activity_start_date = new Date(activity.start_date);
    const points = google.maps.geometry.encoding.decodePath(activity.map.summary_polyline).map(latlng => [latlng.lng(), latlng.lat()]);
    const graphic = new Graphic({
      geometry: {
        type: 'multipoint',
        points: points,
      },
      symbol: {
        type: 'simple-line',
        color: COLORS[activity.sport_type] ?? 'black',
        width: WIDTH[activity.sport_type] ?? 1.0,
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
      visible: activity_start_date >= arcgisTimeSlider.timeExtent.start && activity_start_date <= arcgisTimeSlider.timeExtent.end,
    });

    // TODO(martin.letis): deduplicate visibility logic, trigger handler immediately?
    arcgisTimeSlider.addEventListener('arcgisPropertyChange', event => {
      if (event.detail.name != 'timeExtent') {
        return;
      }
      graphic.visible = activity_start_date >= arcgisTimeSlider.timeExtent.start && activity_start_date <= arcgisTimeSlider.timeExtent.end;
    });

    arcgisMap.componentOnReady().then(() => arcgisMap.graphics.add(graphic));

    // If the view isn't already centered - by 'position' or a previous activity - center it on this activity.
    if (!arcgisMap.center) {
      arcgisMap.center = graphic.geometry.extent.center;
      arcgisMap.zoom = 10;
    }
  });

  if (activities.length > 0) {
    // Get oldest activity date.
    // TODO(martin.letis): is the oldest activity always last?
    const activity_start_dates = activities.map(activity => new Date(activity.start_date).getTime());
    const activity_start_date = new Date(Math.min(...activity_start_dates));
    activity_start_date.setHours(0, 0, 0, 0);

    arcgisTimeSlider.fullTimeExtent.start = new Date(Math.min(arcgisTimeSlider.fullTimeExtent.start, activity_start_date));
  } else {
    // Enable slider.
    arcgisTimeSlider.disabled = false;
  }
};

fetchActivities(displayActivities);
