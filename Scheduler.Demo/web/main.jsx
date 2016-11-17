window.jQuery = window.$ = require('jquery');
require('signalr');                   //babel reorders these if we use import syntax

import React from 'react';
import ReactDOM from 'react-dom';
import newApp$ from './components/app.jsx';
import Rx from 'rxjs';

window.onload = () => {
    const conn = $.hubConnection();
    conn.url = 'http://localhost:9595/signalr';

    const hub = conn.createHubProxy('schedulerHub');
    hub.logging = true;

    var sub = new Rx.Subject();

    hub.on('handle', (schedId, jobId) => {
        // console.log(jobId);
        sub.next({ schedId: schedId, jobId: jobId });
    });

    conn.start()
        .done(() => {
            console.log('Now connected, connection ID=' + conn.id);
            run(hub, sub);
        })
        .fail(() => { console.log('Could not connect'); });
};


function run(hub, sub) {    
    newApp$(sub, hub)
        .subscribe(r => { 
            ReactDOM.render(r, document.getElementById('root')); 
        });
}


