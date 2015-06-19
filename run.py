#!/usr/bin/env python

from flask import Flask, render_template
from flask_socketio import SocketIO, emit

import logging
import numpy as np
import pandas as pd

app = Flask(__name__)
socketio = SocketIO(app)
logging.basicConfig(level=logging.DEBUG)


def make_df(rows=5, cols=5):
    return pd.DataFrame(np.random.randn(rows, cols))


@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('df', namespace="/test")
def test_message(json):
    emit('df', {'data': make_df(json['r'], json['c']).to_dict('split')['data']})


@socketio.on('my broadcast event', namespace='/test')
def test_message(message):
    emit('my response', {'data': message['data']}, broadcast=True)


@socketio.on('connect', namespace='/test')
def test_connect():
    emit('my response', {'data': 'Connected'})


@socketio.on('disconnect', namespace='/test')
def test_disconnect():
    print('Client disconnected')


if __name__ == '__main__':
    socketio.run(app)
