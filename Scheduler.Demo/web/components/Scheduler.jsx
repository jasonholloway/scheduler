import React from 'react';
import Graph from './Graph.jsx';
import Guid from 'guid';
import Rx from 'rxjs';
import wu from 'wu';

class Scheduler extends React.Component {  //component should auto-register new scheduler

    constructor() {
        super();
        this.jobMap = new Map();        
    }

    componentWillMount() {
        this.props.events
            .subscribe(ev => true);

        this.jobStreams = this.props.events
                                .groupBy(k => k.jobId);   
                                
        this.jobs = this.jobStreams.map((v, k) => <li>Job: {k}</li>);
    }

    render() {        
        var addJob = () => {
            this.props.hub.invoke('addJob', this.props.schedulerId, Guid.raw());
            this.forceUpdate();            
        }

        console.log(this.jobs);

        return <div>
                <h1>Scheduler {this.props.schedulerId}</h1>
                <Graph/>               
                <button onClick={addJob}>Add Job</button>
                <ul>
                    {Array.from(this.jobs)}
                </ul>
            </div>
    }
}

export { Scheduler as default };
