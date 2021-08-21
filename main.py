import flask
import json
import time
import urllib
from google.cloud import datastore

# https://www.nsw.gov.au/media-releases/covid-19-restrictions-tightened-across-greater-sydney
_10K_AFTER = 1625814000

# https://www.nsw.gov.au/media-releases/increased-fines-test-and-isolate-payments-and-new-compliance-measures-as-nsw-battles
_10K_BEFORE = _5K_AFTER = 1629036060

CLIENT_ID = "69382"
CLIENT_SECRET = "5bcd3a399f4c849a2ffadf249eccecabbbaddca9"

app = flask.Flask(__name__)
datastore_client = datastore.Client()


def refresh_token(token):
  data = urllib.parse.urlencode({
      "client_id": CLIENT_ID,
      "client_secret": CLIENT_SECRET,
      "grant_type": "refresh_token",
      "refresh_token": token["refresh_token"],
  }).encode("ascii")
  with urllib.request.urlopen(
      "https://www.strava.com/api/v3/oauth/token", data=data) as response:
    token.update(json.loads(response.read()))
    datastore_client.put(token)


@app.route("/activities")
def activities():
  after = flask.request.args.get("after")
  before = flask.request.args.get("before")

  params = {}
  if (after):
    params["after"] = after
  if (before):
    params["before"] = before

  activitiesUrl = urllib.parse.urlparse(
      "https://www.strava.com/api/v3/athlete/activities")
  activitiesUrl = activitiesUrl._replace(query=urllib.parse.urlencode(params))

  key = datastore_client.key("Token", "token")
  token = datastore_client.get(key)
  if token is None:
    flask.abort(503, "Invalid storage status")

  if time.time() > token["expires_at"]:
    refresh_token(token)
  
  headers = {"Authorization": "Bearer %s" % token["access_token"]}
  request = urllib.request.Request(activitiesUrl.geturl(), headers=headers)
  with urllib.request.urlopen(request) as response:
    return response.read()


if __name__ == "__main__":
  app.run(host="localhost", port=8080, debug=True)
