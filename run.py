#!/usr/bin/env python

from flask import Flask, render_template
from flask_socketio import SocketIO, emit, send

import json
import logging
import numpy as np
import pandas as pd
import datetime as dt

app = Flask(__name__)
socketio = SocketIO(app)
logging.basicConfig(level=logging.DEBUG)

chats = []

def make_df(rows=5, cols=5):
    return pd.DataFrame(np.random.randn(rows, cols))


@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('df', namespace="/test")
def test_message(json):
    emit('df', {'data': make_df(json['r'], json['c']).to_dict('split')['data']})


@socketio.on('broadcast', namespace="/chat")
def chat(message):
    resp = {"name": message['data'].get("name") or "ANON",
            "timestamp": dt.datetime.now().isoformat(),
            "message": message['data'].get('content')}
    chats.append(resp)
    print "[%(name)s] %(timestamp)s: %(message)s" % resp
    with open('cache.json', 'w+') as f:
        json.dump(chats, f)
    emit('my response', {'data': [resp]}, broadcast=True)


@socketio.on("all", namespace="/chat")
def messages():
    emit('my response', {'data': chats})


@socketio.on('connect', namespace='/chat')
def test_connect():
    print('Client connected')


@socketio.on("forcerefresh", namespace="/chat")
def refresh():
    emit("forcerefresh", {}, broadcast=True)


@socketio.on('disconnect', namespace='/chat')
def test_disconnect():
    print('Client disconnected')


if __name__ == '__main__':
    try:
        with open("cache.json", 'rb') as f:
            chats.extend(json.load(f))
    except:
        pass
    socketio.run(app, host="0.0.0.0")
