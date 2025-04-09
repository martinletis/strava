const url = new URL(window.location.href);
const debug = url.searchParams.has('debug');

function initAuth() {
  console.debug('initAuth()');

  const CLIENT_ID = 69382;
  const CLIENT_SECRET = '5bcd3a399f4c849a2ffadf249eccecabbbaddca9';

  // https://developers.strava.com/docs/authentication/#tokenexchange
  if (url.searchParams.has('code')) {
    const tokenUrl = new URL('https://www.strava.com/oauth/token');
    tokenUrl.searchParams.append('client_id', CLIENT_ID);
    tokenUrl.searchParams.append('client_secret', CLIENT_SECRET);
    tokenUrl.searchParams.append('code', url.searchParams.get('code'));
    tokenUrl.searchParams.append('grant_type', 'authorization_code');
    url.searchParams.delete('code');
    url.searchParams.delete('scope');
    url.searchParams.delete('state');
    console.log('fetch(%s)', tokenUrl.toString());
    return fetch(tokenUrl, {method: 'POST'})
      .then(response => response.json())
      .then(data => {
        window.localStorage.setItem('token', JSON.stringify(data));
        window.location.replace(url.toString());
      });
  }

  // https://developers.strava.com/docs/authentication/#detailsaboutrequestingaccess
  if (!window.localStorage.getItem('token')) {
    const authorizeUrl = new URL('https://www.strava.com/oauth/authorize');
    authorizeUrl.searchParams.append('client_id', CLIENT_ID);
    authorizeUrl.searchParams.append('redirect_uri', url.toString());
    authorizeUrl.searchParams.append('response_type', 'code');
    authorizeUrl.searchParams.append('scope', 'read,activity:read');
    window.location.replace(authorizeUrl.toString());
  }

  const token = JSON.parse(window.localStorage.getItem('token'));

  // https://developers.strava.com/docs/authentication/#refreshingexpiredaccesstokens
  if (token.expires_at * 1000 < Date.now()) {
    const tokenUrl = new URL('https://www.strava.com/oauth/token');
    tokenUrl.searchParams.append('client_id', CLIENT_ID);
    tokenUrl.searchParams.append('client_secret', CLIENT_SECRET);
    tokenUrl.searchParams.append('grant_type', 'refresh_token');
    tokenUrl.searchParams.append('refresh_token', token.refresh_token);
    console.log('fetch(%s)', tokenUrl.toString());
    return fetch(tokenUrl, {method: 'POST'})
      .then(response => response.json())
      .then(data => {
        window.localStorage.setItem('token', JSON.stringify(data));
        return data.access_token;
      });
  }

  return Promise.resolve(token.access_token);
}

function fetchAuthActivities(access_token, callback, page=1) {
  console.debug('fetchAuthActivities(%s, %d)', access_token, page);
  if (!access_token) {
    return;
  }
  let activitiesUrl;
  if (debug) {
    // Run until empty results are returned:
    // curl -H "Authorization: Bearer ${TOKEN}" -X GET "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${PAGE}" | tee debug/activities-${PAGE} 
    activitiesUrl = new URL('/debug/activities-' + page, url)
  } else {
    activitiesUrl = new URL('https://www.strava.com/api/v3/athlete/activities')
    activitiesUrl.searchParams.set('page', page);
    activitiesUrl.searchParams.set('per_page', url.searchParams.get('per_page') || 100);
  }

  console.debug('fetch(%s)', activitiesUrl);
  return fetch(activitiesUrl, {headers: {'Authorization': 'Bearer ' + access_token}})
    .then(response => response.json())
    .then(activities => {
      callback(activities);
      if (activities.length > 0) {
        return fetchAuthActivities(access_token, callback, page + 1);
      }
    });
}

function fetchActivities(callback) {
  console.debug('fetchActivities()');
  initAuth().then(access_token => fetchAuthActivities(access_token, callback));
}

export { fetchActivities }
