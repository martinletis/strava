import flask
import urllib

# https://www.nsw.gov.au/media-releases/covid-19-restrictions-tightened-across-greater-sydney
_10K_AFTER = 1625814000

# https://www.nsw.gov.au/media-releases/increased-fines-test-and-isolate-payments-and-new-compliance-measures-as-nsw-battles
_10K_BEFORE = _5K_AFTER = 1629036060

app = flask.Flask(__name__)


@app.route('/json')
def json():
  after = flask.request.args.get('after')
  before = flask.request.args.get('before')

  params = {}
  if (after):
    params['after'] = after
  if (before):
    params['before'] = before
    
  activitiesUrl = urllib.parse.urlparse(
      'https://www.strava.com/api/v3/athlete/activities')
  activitiesUrl = activitiesUrl._replace(query=urllib.parse.urlencode(params))

  request = urllib.request.Request(activitiesUrl.geturl(), headers = {
    'Authorization': 'Bearer 11e54edafa0c6b22357eda56c898489d85ec8882'
  })
  with urllib.request.urlopen(request) as response:
    return response.read()


if __name__ == '__main__':
  app.run(host='localhost', port=8080, debug=True)
