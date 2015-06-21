<raw>
    this.root.innerHTML = opts.content;
</raw>

<status>
    <nav class="navbar navbar-default">
      <div class="container-fluid">
        <div class="navbar-header pull-left">
            <a class="navbar-brand" href="#">GhettoChat</a>
            <form class="navbar-form pull-left">
                <div class="form-group">
                    <input type="text" id="name" placeholder="Name" width="10%" 
                        onkeyup={ store } value={ nickname } class="form-control"
                        required>
                </div>
            </form>
        </div>
        <div class="navbar-header pull-right">
            <p class="navbar-text">Status: 
                <span class=" text-{success: connected, danger: !connected}">
                    { (connected) ? 'ONLINE' : 'OFFLINE' }
                </span>
            </p>
        </div>
      </div>
    </nav>

    this.connected = false;
    this.nickname = localStorage["name"];
    this.reconnecting = false;

    store(e) {
        localStorage["name"] = e.target.value;
    }
</status>

<chat>
    <status></status>
    <div class="container-fluid">
        <ul class="nav nav-tabs" role="tablist">
            <li each={ room, i in rooms }
                role="presentation"
                class={ active: room == 'General' }>
                <a href="#{room}" 
                   aria-controls={room} 
                   data-toggle="tab">{room} <small class="text-success" if={ parent.typers[room].length }>{ parent.typers[room].join(', ') }</small></a>
            </li>
        </ul>
        <div class="tab-content">
            <div each={ room, i in rooms } 
                 class="tab-pane { active: room == 'General' } chat"
                 id={ room }>
                <p each={ parent.messages[room] }>
                    <span class="text-muted" if={ timestamp }>[{ moment(timestamp).format('YYYY-MM-DD HH:mm:ss') }]</span>
                    <raw content={ colorize(name) + ': ' } if={ name }/>
                    <raw content={ linkify(message) } if={ message }/>
                    <span class="text-muted" if={ status }>* { status }</p>
                </p>
            </div>
        </div>
        <textarea class="form-control" id="content" 
            placeholder="Type message, press Enter to submit" 
            onkeyup={ prepsubmit }
            disabled={ !tags.status.connected }
            required></textarea>
    </div>
    
    <style scoped>
        .chat {
            height: 68vmin;
            overflow-y: scroll;
            margin-bottom: 10px;
            padding: 2px 10px;
        }

        .chat > p {
            line-height: 1.4em;
            font-size: 14px;
            margin: 0;
        }

        textarea.form-control {
            height: 13vh;
        }

        .nav > li > a {
            font-size: 0.9em;
            padding: 6px 8px;
        }
    </style>

    this.version = opts.version;
    this.socket = null;
    this.rooms = ["General"];
    this.messages = {"General": []};
    this.activeRoom = "General";
    this.typers = {"General": []};
    var that = this;

    dosubmit() {
        var name = strip(this.tags.status.name.value);
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
    }

    _signalTyping(state) {
        if (!state || this.typers[this.activeRoom].indexOf(this.tags.status.nickname) < 0) {
            this.socket.emit("typing", {
                name: this.tags.status.nickname,
                room: this.activeRoom,
                typing: state
            });
        }
        if (state) {
            clearTimeout(this.revertTyping);
            this.revertTyping = _.delay(this._signalTyping, 2500, false);
        }
    }

    this.signalTyping = _.debounce(this._signalTyping, 100, true)

    prepsubmit(e) {
        if (e.which === 13 && !e.shiftKey) {
            this.dosubmit();
            e.currentTarget.value = "";
            clearTimeout(this.revertTyping);
            this._signalTyping(false);          
        } else if (!e.altKey && !e.metaKey && !e.ctrlKey) {
            this.signalTyping(true);
        }
    }

    pushStatus(room, text, doScroll, timestamp) {
        this.messages[room].push({
            status: text,
            timestamp: timestamp
        });
        this.update();
        if (doScroll) {
            var dom = this[this.activeRoom];
            dom.scrollTop = dom.scrollHeight;
        }        
    }

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
                dom.scrollTop = dom.scrollHeight;
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

        this.socket.on("typing", function(message) {
            var typers = _.reject(message.data, function(n) { return n === that.tags.status.nickname; });
            that.typers[message.room] = typers;
            that.update();
        })

        this.socket.on("leave", function(message) {
            that.pushStatus(message.data.room || that.activeRoom,
                message.data.name + " has disconnected",
                !message.data.room || (message.data.room === that.activeRoom),
                message.data.timestamp
            );
        });

        this.socket.on("connect", function() {
            that.socket.emit("join", {
                name: that.tags.status.nickname,
                room: "General",
                reconnect: that.tags.status.reconnecting || false
            });
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
</chat>

function linkify(m) {
    var l = strip(m), chk = m.trim();
    if (chk.startsWith("http://") || chk.startsWith("https://")) {
        l = '<a href="' + chk + '">' + chk + '</a>';
        if (chk.endsWith(".jpg") || chk.endsWith(".gif") || chk.endsWith(".png")) {
            l = '<img src="' + chk + '" />';
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