"""A Strava bulk updater."""

import json
import time
from urllib.parse import urlparse
from absl import app
from absl import flags
from absl import logging
import requests


FLAGS = flags.FLAGS

flags.DEFINE_integer('client_id', 69382, '')
flags.DEFINE_string(
    'client_secret', '5bcd3a399f4c849a2ffadf249eccecabbbaddca9', ''
)
flags.DEFINE_string('code', None, '')
flags.DEFINE_string('file', None, '', required=True)
flags.DEFINE_string('gear_id', None, '')
flags.DEFINE_multi_integer('ids', None, '')
flags.DEFINE_integer('per_page', 100, '')


def main(argv):

  if FLAGS.code:
    # https://developers.strava.com/docs/authentication/#tokenexchange
    logging.info('Exchanging token...')
    r = requests.post(
        'https://www.strava.com/oauth/token',
        {
            'client_id': FLAGS.client_id,
            'client_secret': FLAGS.client_secret,
            'code': FLAGS.code,
            'grant_type': 'authorization_code',
        },
    )
    logging.info('Writing to %s: %s', FLAGS.file, r.json())
    with open(FLAGS.file, 'w') as f:
      json.dump(r.json(), f)

  try:
    with open(FLAGS.file) as f:
      file_data = json.load(f)
  except FileNotFoundError as e:
    logging.info(e)
    # https://developers.strava.com/docs/authentication/#detailsaboutrequestingaccess
    params = {
        'client_id': FLAGS.client_id,
        'redirect_uri': 'http://localhost/exchange_token',
        'response_type': 'code',
        'scope': ','.join(['read', 'activity:read_all', 'activity:write']),
    }
    logging.info(
        'Please visit the following URL and rerun with --code={code}:'
        ' https://www.strava.com/oauth/authorize?%s',
        '&'.join(['='.join([k, '%s' % v]) for (k, v) in params.items()]),
    )
    return

  if file_data['expires_at'] < time.time():
    # https://developers.strava.com/docs/authentication/#refreshingexpiredaccesstokens
    logging.info('Refreshing token...')
    r = requests.post(
        'https://www.strava.com/oauth/token',
        {
            'client_id': FLAGS.client_id,
            'client_secret': FLAGS.client_secret,
            'grant_type': 'refresh_token',
            'refresh_token': file_data['refresh_token'],
        },
    )
    logging.info('Writing to %s: %s', FLAGS.file, r.json())
    with open(FLAGS.file, 'w') as f:
      json.dump(r.json(), f)
    file_data = r.json()

  if FLAGS.ids:
    data = {}
    if FLAGS.gear_id:
      data['gear_id'] = FLAGS.gear_id
    if not data:
      logging.error('No update data defined')
      return
    for id in FLAGS.ids:
      # https://developers.strava.com/docs/reference/#api-Activities-updateActivityById
      logging.info('Updating activity %d with data %s...', id, data)
      r = requests.put(
          'https://www.strava.com/api/v3/activities/%d' % id,
          data=data,
          headers={'Authorization': 'Bearer %s' % file_data['access_token']},
      )
      if r.status_code != 200:
        logging.info(
            'Error updating activity %d: %d %s', id, r.status_code, r.json()
        )
      else:
        logging.info('Successfully updated activity %d', r.json()['id'])
    return

  logging.info('Getting athlete activities...')
  print('ID,START_DATE_LOCAL,TIMEZONE,NAME,SPORT_TYPE,GEAR_ID')
  page = 1
  while True:
    # https://developers.strava.com/docs/reference/#api-Activities-getLoggedInAthleteActivities
    r = requests.get(
        'https://www.strava.com/api/v3/athlete/activities',
        headers={'Authorization': 'Bearer %s' % file_data['access_token']},
        params={'page': page, 'per_page': FLAGS.per_page},
    )
    if not r.json():
      break
    for a in r.json():
      print(
          '%d,%s,%s,%s,%s,%s'
          % (
              a['id'],
              a['start_date_local'],
              a['timezone'],
              a['name'],
              a['sport_type'],
              a['gear_id'],
          )
      )
    page += 1


if __name__ == '__main__':
  app.run(main)
