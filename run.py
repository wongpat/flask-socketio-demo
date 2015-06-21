#!/usr/bin/env python

from collections import Counter, defaultdict
from flask import Flask, render_template, send_from_directory, session
from flask.ext.socketio import SocketIO, emit, join_room, leave_room, send
from uuid import uuid4

import json
import logging
import datetime as dt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'ccct!!!!'
app.debug = True
socketio = SocketIO(app)
logging.basicConfig(level=logging.INFO)
chats = []
users = {}
active_users = Counter()
typers = defaultdict(set)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/js/<path:path>')
def send_js(path):
    return send_from_directory('', path)


@socketio.on('broadcast', namespace="/chat")
def chat(message):
    room = message['data'].get("room", "General")
    resp = {"name": message['data'].get("name") or "ANON",
            "timestamp": dt.datetime.now().isoformat(),
            "room": room,
            "message": message['data'].get('content')}
    chats.append(resp)
    with open('cache.json', 'w+') as f:
        json.dump(chats, f)
    emit('my response', {'data': [resp]}, room=room)


@socketio.on("join", namespace="/chat")
def on_join(message):
    print "JOIN", session['id'], message
    room = message['room']
    name = message['name']
    join_room(room)
    users[session['id']] = name
    active_users[name] += 1
    if not message.get('reconnect', False):
        emit('my response', {'data': [c for c in chats if c.get("room", "General") == room][-500:]})
    emit('join', {'data': {
        'name': name, 
        'room': room,
        'timestamp': dt.datetime.now().isoformat()
    }}, room=room)


@socketio.on("leave", namespace="/chat")
def on_leave(message):
    room = message['room']
    name = message['name']
    leave_room(room)    
    print name, "has left the chat"
    emit('leave', {'data': {
        'name': name, 
        'room': room,
        'timestamp': dt.datetime.now().isoformat()
    }}, room=room)


@socketio.on('connect', namespace='/chat')
def test_connect():
    session['id'] = uuid4()
    print 'Client connected', session['id']


@socketio.on("typing", namespace="/chat")
def typing(message):
    room = message['room']
    name = message['name']
    status = message['typing']
    if status:
        typers[room].add(name)
    else:
        typers[room].discard(name)
    emit('typing', {'data': list(typers[room]), 'room': room}, room=room)


@socketio.on('disconnect', namespace='/chat')
def test_disconnect():
    global active_users
    print 'Disconnect', session['id']
    user = users.pop(session['id'], None)
    active_users[user] -= 1    
    if active_users[user] <= 0:
        socketio.emit('leave', {'data': {
            'name': user,
            'timestamp': dt.datetime.now().isoformat()
        }}, namespace="/chat")
    active_users += Counter()


if __name__ == '__main__':
    try:
        with open("cache.json", 'rb') as f:
            chats.extend(json.load(f))
    except:
        pass
    socketio.run(app, host="0.0.0.0")
