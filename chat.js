riot.tag('raw', '', function(opts) {
    this.root.innerHTML = opts.content;

});

riot.tag('status', '<nav class="navbar navbar-default"> <div class="container-fluid"> <div class="navbar-header pull-left"> <a class="navbar-brand" href="#">GhettoChat</a> </div> <div class="navbar-header pull-right"> <p class="navbar-text">{ parent.nickname } | Status: <span class=" text-{success: connected, danger: !connected}"> { (connected) ? \'ONLINE\' : \'OFFLINE\' } </span> </p> </div> </div> </nav>', function(opts) {

    this.connected = false;
    this.reconnecting = false;

});

riot.tag('welcome', '<div class="overlay"></div> <div class="panel panel-default" id="nameform"> <div class="panel-heading"> <h3 class="panel-title">Enter your name</h3> </div> <form onsubmit="{ parent.join }"> <div class="panel-body"> <input type="text" class="form-control" id="nickname" value="{ localStorage[\'name\'] }" required autofocus> </div> <div class="panel-footer"> <input type="submit" class="btn btn-primary"> </div> </form> </div>', '#nameform { position: fixed; top: 10vh; left: 50%; z-index: 11; margin-left: -150px; width: 300px; } .overlay { z-index: 10; background-color: rgba(0, 0, 0, 0.5); position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; } #nameform form { margin: 0; }', function(opts) {

});

riot.tag('chat', '<status></status> <welcome if="{ !nickname }"></welcome> <div class="container-fluid" if="{ nickname }"> <div class="row"> <div class="col-xs-10 col-lg-11"> <ul class="nav nav-tabs" role="tablist"> <li each="{ room, i in rooms }" role="presentation" class="{ active: room == parent.activeRoom }"> <a href="#{room}" aria-controls="{room}" data-toggle="tab">{room} <small class="text-success" if="{ parent.typers[room].length }"> <i class="fa fa-weixin fa-spin"></i> { parent.typers[room].join(\', \') } </small> </a> </li> </ul> <div class="tab-content"> <div each="{ room, i in rooms }" class="tab-pane { active: room == parent.activeRoom } chat" id="{ room }"> <p each="{ parent.messages[room] }"> <span class="text-muted" if="{ timestamp }">[{ moment(timestamp).format(\'YYYY-MM-DD HH:mm:ss\') }]</span> <raw content="{ colorize(name) + \': \' }" if="{ name }"></raw> <raw content="{ linkify(message) }" if="{ message }"></raw> <span class="text-muted" if="{ status }">* { status }</p> </p> </div> </div> </div> <div class="col-xs-2 col-lg-1"> <h5>Users</h5> <ul class="list-unstyled" style="font-size: 0.9em"> <li each="{ member, i in roomMembers[activeRoom] }"> <i class="fa fa-user"></i> <raw content="{ colorize(member) }"></raw> </li> </ul> </div> </div> <textarea class="form-control" id="content" placeholder="Type message, press Enter to submit" onkeyup="{ prepsubmit }" __disabled="{ !tags.status.connected }" required></textarea> </div>', 'chat .chat , [riot-tag="chat"] .chat { height: 68vmin; overflow-y: scroll; margin-bottom: 10px; padding: 2px 10px; } chat .chat > p , [riot-tag="chat"] .chat > p { line-height: 1.4em; font-size: 14px; margin: 0; } chat textarea.form-control , [riot-tag="chat"] textarea.form-control { height: 13vh; } chat .nav > li > a , [riot-tag="chat"] .nav > li > a { font-size: 0.9em; padding: 6px 8px; }', function(opts) {

    this.version = opts.version;
    this.socket = null;
    this.rooms = ["General"];
    this.roomMembers = {"General": []};
    this.messages = {"General": []};
    this.typers = {"General": []};
    this.nickname = "";
    this.activeRoom = "General";
    var that = this;

    this.dosubmit = function() {
        var name = strip(this.nickname);
        var content = strip(this.content.value);
        if (content && content !== "\n") {
            this.socket.emit("broadcast", {
                data: {
                    name: name,
                    content: content,
                    room: this.activeRoom
                }
            });
        }       
    }.bind(this);

    this.isConnected = function() {
        return this.tags.status.connected;
    }.bind(this);

    this.isReconnecting = function() {
        return this.tags.status.reconnecting;
    }.bind(this);

    this._signalTyping = function(state) {
        if (!state || this.typers[this.activeRoom].indexOf(this.nickname) < 0) {
            this.socket.emit("typing", {
                name: this.nickname,
                room: this.activeRoom,
                typing: state
            });
        }
        if (state) {
            clearTimeout(this.revertTyping);
            this.revertTyping = _.delay(this._signalTyping, 2500, false);
        }
    }.bind(this);

    this.signalTyping = _.debounce(this._signalTyping, 100, true);

    this.prepsubmit = function(e) {
        if (e.which === 13 && !e.shiftKey) {
            this.dosubmit();
            e.currentTarget.value = "";
            clearTimeout(this.revertTyping);
            this._signalTyping(false);          
        } else if (!e.altKey && !e.metaKey && !e.ctrlKey) {
            this.signalTyping(true);
        }
    }.bind(this);

    this.pushStatus = function(room, text, doScroll, timestamp) {
        this.messages[room].push({
            status: text,
            timestamp: timestamp
        });
        this.update();
        if (doScroll) {
            var dom = this[this.activeRoom];
            dom.scrollTop = dom.scrollHeight * 3;
        }        
    }.bind(this);

    this.join = function(e) {
        e.preventDefault();
        this.nickname = localStorage["name"] = $("input", e.target).val();
        this.socket.emit("join", {
            name: this.nickname,
            room: "General",
            reconnect: that.tags.status.reconnecting || false
        });
    }.bind(this);

    this.on("mount", function() {
        this.socket = io.connect('http://' + document.domain + ":" + location.port + "/chat");
        this.socket.on('my response', function(msg) {
            var oneMessageInCurrentWindow = false;
            msg.data.forEach(function(message) {
                var room = message.room || "General";
                var group = that.messages[room];
                if (!group) {
                    group = [];
                    that.messages[message.room] = group;
                }
                oneMessageInCurrentWindow |= (room === that.activeRoom);
                group.push(message);
            });    
            that.update();      
            if (oneMessageInCurrentWindow) {
                var dom = that[that.activeRoom];
                dom.scrollTop = dom.scrollHeight * 3;
            }
        }); 

        this.socket.on("join", function(message) {
            if (message.data.name !== that.tags.status.nickname) {
                that.pushStatus(message.data.room,
                    message.data.name + " has joined this chat",
                    message.data.room === that.activeRoom,
                    message.data.timestamp
                );
            }          
        });

        this.socket.on("leave", function(message) {
            that.pushStatus(message.data.room || that.activeRoom,
                message.data.name + " has disconnected",
                !message.data.room || (message.data.room === that.activeRoom),
                message.data.timestamp
            );
        });

        this.socket.on("room_members", function(message) {
            console.debug(message.data.members);
            that.roomMembers[message.data.room] = message.data.members;
            that.update();
        })

        this.socket.on("typing", function(message) {
            var typers = _.reject(message.data.members, function(n) { return n === that.nickname; });
            that.typers[message.data.room] = typers;
            that.update();
            if (typers.length)
                document.title = typers.join(", ") + " - GhettoChat"
            else
                document.title = "GhettoChat";
        })

        this.socket.on("connect", function() {
            if (that.isReconnecting() && that.nickname) {
                that.socket.emit("join", {
                    name: that.nickname,
                    room: "General",
                    reconnect: true
                });
            }
            that.tags.status.update({connected: true, reconnecting: false});
        });       

        this.socket.on("disconnect", function() {
            that.tags.status.update({connected: false, reconnecting: true});
        })

        $('a[data-toggle="tab"]').on("shown.bs.tab", function(e) {
            that.activeTab = e.target.getAttribute('id');
            e.target.scrollTop = e.target.scrollHeight;
        });
    })

});

function parse_youtube(url) {
    var a = document.createElement("a");
    a.href = url;
    if (a.pathname === "/watch") {
        return url.replace("watch?v=", "embed/").replace("https", "http");
    } else {
        return "http://youtube.com/embed" + a.pathname;
    }
}

function linkify(m) {
    var l = strip(m), chk = m.trim();
    if (chk.startsWith("http://") || chk.startsWith("https://")) {
        l = '<a href="' + chk + '">' + chk + '</a>';
        if (chk.endsWith(".jpg") || chk.endsWith(".gif") || chk.endsWith(".png")) {
            l = '<img src="' + chk + '" />';
        }
        // Youtube embed
        if ((chk.indexOf("youtube") > 0 && chk.indexOf("watch") > 0) || 
            chk.indexOf("youtu.be") > 0) {
            l = [//'<div class="embed-responsive embed-responsive-16by9">',
                 '<iframe class="embed-responsive-item" width="560" height="315" src="', 
                 parse_youtube(chk), 
                 '" allowfullscreen></iframe>'].join("");
        }
    }
    return l.replace(/\n/g, "<br />");
}

function strip(html) {
   var tmp = document.createElement("DIV");
   tmp.innerHTML = html;
   return tmp.textContent || tmp.innerText || "";
}

function colorize(text) {
    var hash = text.hashCode() + text.length * 4;
    var hsl = "color: hsl(" + hash % 255 + ", 60%, 50%)";
    return '<span style="' + hsl + '">' + text + '</span>';
}

String.prototype.hashCode = function() {
  var hash = 0, i, chr, len;
  if (this.length == 0) return hash;
  for (i = 0, len = this.length; i < len; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

if (typeof String.prototype.endsWith !== 'function') {
  String.prototype.endsWith = function(str) {
    return this.substring(this.length - str.length, this.length) === str;
  }
};

if (typeof String.prototype.startsWith !== 'function') {
  String.prototype.startsWith = function(str) {
    return this.substring(0, str.length) === str;
  }
};