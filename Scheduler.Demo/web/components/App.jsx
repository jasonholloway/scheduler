import React from 'react'
import Scheduler from './Scheduler.jsx'
import Guid from 'guid'
import Rx from 'rxjs'
import wu from 'wu'

//and how do i get signalr hub here?

class App extends React.Component {

    render() {
        var hub = this.props.hub;
            
        var schedId = Guid.raw();
        var jobId = Guid.raw();

        hub.invoke('addScheduler', schedId);

        var events = this.props.events.where(c => c.schedId === schedId);

        return <div>
            <button>Add Scheduler</button>
            <ul>
                <li><Scheduler hub={hub} events={events} schedulerId={schedId}/></li>
            </ul>
        </div>
    }
}



function newJob$(jobId, ev$, hub) {
    return ev$.scan((ac, ev) => <h4>{ev.jobId}</h4>, {})
              .map(x => ({ id:jobId, el:x }));
}


function newScheduler$(schedId, ev$, hub) {

    const onClick = () => {
        hub.invoke('addJob', schedId, Guid.raw());
    };

    return ev$.groupBy(ev => ev.jobId)
                .flatMap((group, i) => newJob$(group.key, group, hub))
                .scan((jobs, job) => { jobs.set(job.id, job.el); return jobs; }, new Map())
                .map(jobs => Array.from(jobs)
                                    .map(([k, v]) => <li key={k}>{v}</li>) )
                .map(els => ({ 
                                id: schedId, 
                                el: <div>
                                        <button onClick={onClick}>Add Job</button>
                                        <ul>{ els }</ul>
                                    </div> 
                            }));
}

function newApp$(ev$, hub) {

    const fnClick = () => {
        var schedId = Guid.raw();
        hub.invoke('addScheduler', schedId);
        hub.invoke('addJob', schedId, Guid.raw());
    };

    fnClick();

    return ev$
            .groupBy(ev => ev.schedId)               
            .flatMap((group, i) => newScheduler$(group.key, group, hub))
            .scan((scheds, sched) => { scheds.set(sched.id, sched.el); return scheds; }, new Map())    
            .map(scheds => Array.from(wu(scheds.entries()).map(([k, v]) => <li key={k}>{v}</li>)))
            .map(els => <div>
                            <button onClick={fnClick}>Add Scheduler</button>
                            <ul>{els}</ul>
                        </div>);
                
}


export default newApp$;
