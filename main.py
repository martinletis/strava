import flask
import json
import os
import time
import urllib
from google.cloud import datastore

# https://www.nsw.gov.au/media-releases/covid-19-restrictions-tightened-across-greater-sydney
_10K_AFTER = 1625814000

# https://www.nsw.gov.au/media-releases/increased-fines-test-and-isolate-payments-and-new-compliance-measures-as-nsw-battles
_10K_BEFORE = _5K_AFTER = 1629036060

app = flask.Flask(__name__)
datastore_client = datastore.Client()


@app.route("/all")
def all():
  return render(
      after="undefined",
      before="undefined",
      per_page=100,
      radius=10000,
      zoom=12)


@app.route("/5k")
def five():
  return render(
      after=_5K_AFTER,
      before="undefined",
      per_page="undefined",
      radius=5000,
      zoom=13)


@app.route("/10k")
def ten():
  return render(
      after=_10K_AFTER,
      before=_10K_BEFORE,
      per_page="undefined",
      radius=10000,
      zoom=12)


@app.route("/activities")
def activities():
  after = flask.request.args.get("after")
  before = flask.request.args.get("before")
  page = flask.request.args.get("page")
  per_page = flask.request.args.get("per_page")

  params = {}
  if (after):
    params["after"] = after
  if (before):
    params["before"] = before
  if (page):
    params["page"] = page
  if (per_page):
    params["per_page"] = per_page

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


def refresh_token(token):
  client_id = os.getenv("CLIENT_ID")
  if client_id is None:
    flask.abort(503, "Invalid CLIENT_ID")

  client_secret = os.getenv("CLIENT_SECRET")
  if client_secret is None:
    flask.abort(503, "Invalid CLIENT_SECRET")

  data = urllib.parse.urlencode({
      "client_id": client_id,
      "client_secret": client_secret,
      "grant_type": "refresh_token",
      "refresh_token": token["refresh_token"],
  }).encode("ascii")
  with urllib.request.urlopen(
      "https://www.strava.com/api/v3/oauth/token", data=data) as response:
    token.update(json.loads(response.read()))
    datastore_client.put(token)


def render(after, before, per_page, radius, zoom):
  api_key = os.getenv("API_KEY")
  if api_key is None:
    flask.abort(503, "Invalid API_KEY")
  return flask.render_template(
      "map.html",
      after=after,
      before=before,
      per_page=per_page,
      api_key=api_key,
      radius=radius,
      zoom=zoom)


if __name__ == "__main__":
  app.run(host="localhost", port=8080, debug=True)
