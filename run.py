#!/usr/bin/env python

from collections import Counter, defaultdict
from flask import Flask, render_template, send_from_directory, session, jsonify
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
rooms = defaultdict(Counter)
typers = defaultdict(set)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/history')
def history():
    return jsonify({'data': chats})


@app.route('/js/<path:path>')
def send_js(path):
    return send_from_directory('', path)


@app.route('/css/<path:path>')
def send_css(path):
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
    rooms[room][name] += 1
    if not message.get('reconnect', False):
        emit('my response', {'data': [c for c in chats if c.get("room", "General") == room][-500:]})
    emit('join', {'data': {
        'name': name, 
        'room': room,
        'timestamp': dt.datetime.now().isoformat()
    }}, room=room)
    emit('room_members', {'data': {
        'members': list(set(rooms[room])), 
        'room': room
    }}, room=room)


@socketio.on("leave", namespace="/chat")
def on_leave(message):
    room = message['room']
    name = message['name']
    leave_room(room)    
    print name, "has left the chat"
    rooms[room][name] -= 1
    rooms[room] += Counter()
    emit('leave', {'data': {
        'name': name, 
        'room': room,
        'timestamp': dt.datetime.now().isoformat()
    }}, room=room)
    emit('room_members', {'data': {
        'members': list(set(rooms[room])), 
        'room': room
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
    emit('typing', {'data': {
        'members': list(typers[room]), 
        'room': room
    }}, room=room)


@socketio.on('disconnect', namespace='/chat')
def test_disconnect():
    global active_users
    user = users.pop(session['id'], None)
    active_users[user] -= 1   
    active_users += Counter()
    print 'Disconnect', user, session['id'] 
    for room, members in rooms.viewitems():
        if active_users[user] <= 0:
            del members[user]
            socketio.emit('room_members', {'data': {
                'room': room,
                'members': list(set(members))
            }}, room=room, namespace="/chat")
            typers[room].discard(user)
    if active_users[user] <= 0:
        socketio.emit('leave', {'data': {
            'name': user,
            'timestamp': dt.datetime.now().isoformat()
        }}, namespace="/chat")


if __name__ == '__main__':
    try:
        with open("cache.json", 'rb') as f:
            chats.extend(json.load(f))
    except:
        pass
    socketio.run(app, host="0.0.0.0")
