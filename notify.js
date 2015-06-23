var notification = window.Notification || window.mozNotification || window.webkitNotification;

if (typeof notification !== "undefined") {
    notification.requestPermission(function(permission) {});

    function notify(title, body, autoClose) {
        var noty = new notification(title, {
            body: body,
            tag: title,
            icon: "https://gp5.googleusercontent.com/-ojkFTTzFmdE/AAAAAAAAAAI/AAAAAAAAAAA/eFl1YPXSa5k/s48-c-k-no/photo.jpg?sz=50"
        });

        if (autoClose) {
            setTimeout(function() { noty.close() }, 5000);
        }

        noty.onclick = function(x) { window.focus(); this.close(); };

        return noty;
    }
}
